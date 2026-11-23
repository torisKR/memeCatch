//! The R2 backend: `uploadR2`, `downloadR2`, `removeR2` and `listR2` of
//! `lib/object-storage.ts`.

use std::fmt;
use std::time::{Duration, SystemTime};

use aws_credential_types::Credentials;
use aws_sigv4::http_request::{
    PayloadChecksumKind, PercentEncodingMode, SignableBody, SignableRequest, SigningSettings,
    UriPathNormalizationMode, sign,
};
use aws_sigv4::sign::v4;
use axum::body::{Body, Bytes};
use axum::http::header::{CONTENT_TYPE, HeaderValue};
use axum::http::{Method, Request, Response, StatusCode};
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, utf8_percent_encode};

use super::{DEFAULT_CONTENT_TYPE, ListEntry, StorageError, StoredObject, form_encode_key};

const R2_CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

/// What `encodeURIComponent` leaves as it is.
const URI_COMPONENT: &AsciiSet = &NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'_')
    .remove(b'.')
    .remove(b'!')
    .remove(b'~')
    .remove(b'*')
    .remove(b'\'')
    .remove(b'(')
    .remove(b')');

/// R2 through its S3 API, signed with SigV4 (`region=auto`, `service=s3`).
pub(super) struct R2 {
    client: Client<HttpsConnector<HttpConnector>, Body>,
    credentials: Credentials,
    /// `<endpoint>/<bucket>`.
    bucket_url: String,
}

impl R2 {
    pub(super) fn new(credentials: Credentials, bucket_url: String) -> Result<Self, String> {
        let mut http = HttpConnector::new();
        http.set_connect_timeout(Some(R2_CONNECT_TIMEOUT));
        http.enforce_http(false);
        // Mozilla's roots are compiled in: the runtime image has no CA bundle.
        // Plain HTTP is allowed only so tests can use a local S3 server.
        let connector = HttpsConnectorBuilder::new()
            .with_provider_and_webpki_roots(rustls::crypto::ring::default_provider())
            .map_err(|error| format!("cannot set up TLS for R2: {error}"))?
            .https_or_http()
            .enable_http1()
            .wrap_connector(http);
        Ok(Self {
            client: Client::builder(TokioExecutor::new()).build(connector),
            credentials,
            bucket_url,
        })
    }

    /// `<endpoint>/<bucket>/<key>`, each key segment encoded as
    /// `encodeURIComponent` does.
    fn object_url(&self, key: &str) -> String {
        let encoded: Vec<String> = key
            .split('/')
            .map(|segment| utf8_percent_encode(segment, URI_COMPONENT).to_string())
            .collect();
        format!("{}/{}", self.bucket_url, encoded.join("/"))
    }

    /// Signs and sends one request and reads the whole answer. Like aws4fetch
    /// for S3, the payload is not part of the signature (`UNSIGNED-PAYLOAD`)
    /// and neither is the content type.
    async fn send(
        &self,
        method: Method,
        url: &str,
        content_type: Option<&str>,
        body: Bytes,
    ) -> Result<Response<Bytes>, StorageError> {
        let transport = |error: &dyn fmt::Display| StorageError::Transport(error.to_string());

        let mut request = Request::builder()
            .method(&method)
            .uri(url)
            .body(Body::from(body))
            .map_err(|error| transport(&error))?;
        if let Some(content_type) = content_type {
            let value = HeaderValue::from_str(content_type).map_err(|error| transport(&error))?;
            request.headers_mut().insert(CONTENT_TYPE, value);
        }

        let identity = self.credentials.clone().into();
        let mut settings = SigningSettings::default();
        // S3 signs the path as sent: no second encoding, no normalization.
        settings.percent_encoding_mode = PercentEncodingMode::Single;
        settings.uri_path_normalization_mode = UriPathNormalizationMode::Disabled;
        settings.payload_checksum_kind = PayloadChecksumKind::XAmzSha256;
        let params = v4::SigningParams::builder()
            .identity(&identity)
            .region("auto")
            .name("s3")
            .time(SystemTime::now())
            .settings(settings)
            .build()
            .map_err(|error| transport(&error))?
            .into();
        let signable = SignableRequest::new(
            method.as_str(),
            url,
            std::iter::empty(),
            SignableBody::UnsignedPayload,
        )
        .map_err(|error| transport(&error))?;
        let (instructions, _signature) = sign(signable, &params)
            .map_err(|error| transport(&error))?
            .into_parts();
        instructions.apply_to_request_http1x(&mut request);

        let response = self
            .client
            .request(request)
            .await
            .map_err(|error| transport(&error))?;
        let (parts, body) = response.into_parts();
        let bytes = axum::body::to_bytes(Body::new(body), usize::MAX)
            .await
            .map_err(|error| transport(&error))?;
        Ok(Response::from_parts(parts, bytes))
    }

    pub(super) async fn put(
        &self,
        key: &str,
        bytes: Bytes,
        content_type: Option<&str>,
    ) -> Result<(), StorageError> {
        let content_type = content_type.unwrap_or(DEFAULT_CONTENT_TYPE);
        let response = self
            .send(
                Method::PUT,
                &self.object_url(key),
                Some(content_type),
                bytes,
            )
            .await?;
        ok_status(response.status())
    }

    pub(super) async fn delete(&self, key: &str) -> Result<(), StorageError> {
        let response = self
            .send(Method::DELETE, &self.object_url(key), None, Bytes::new())
            .await?;
        // The TypeScript does not look at the status of a DELETE, so
        // callers see success here too. Log it so it is not silent.
        if !response.status().is_success() {
            tracing::warn!(status = %response.status(), key, "R2 delete was not successful");
        }
        Ok(())
    }

    /// The entries directly under the key `key`.
    pub(super) async fn list(&self, key: &str) -> Result<Vec<ListEntry>, StorageError> {
        let url = format!(
            "{}?list-type=2&prefix={}%2F&delimiter=%2F",
            self.bucket_url,
            form_encode_key(key)
        );
        let response = self.send(Method::GET, &url, None, Bytes::new()).await?;
        ok_status(response.status())?;
        Ok(parse_list(&String::from_utf8_lossy(response.body())))
    }

    pub(super) async fn read(&self, key: &str) -> Result<Option<StoredObject>, StorageError> {
        let response = self
            .send(Method::GET, &self.object_url(key), None, Bytes::new())
            .await?;
        if response.status() == StatusCode::NOT_FOUND {
            return Ok(None);
        }
        ok_status(response.status())?;
        let content_type = response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
            .unwrap_or(DEFAULT_CONTENT_TYPE)
            .to_owned();
        Ok(Some(StoredObject {
            bytes: response.into_body(),
            content_type,
        }))
    }
}

fn ok_status(status: StatusCode) -> Result<(), StorageError> {
    if status.is_success() {
        Ok(())
    } else {
        Err(StorageError::Status(status))
    }
}

/// Reads a ListObjectsV2 answer into what `listR2` returns: folders first, then
/// objects, names without their path.
///
/// The TypeScript uses two regular expressions, and the one for objects needs
/// `<Key>` before `<LastModified>`, the order in AWS's documented answer. Here
/// each `<Contents>` is read whatever the order of its children, which gives
/// the same entries for that order and correct ones for any other.
fn parse_list(xml: &str) -> Vec<ListEntry> {
    let mut entries = Vec::new();

    // /<CommonPrefixes><Prefix>[^<]*\/([^/<]+)\//g
    for prefixes in xml.split("<CommonPrefixes>").skip(1) {
        let Some(prefix) = element(prefixes, "Prefix") else {
            continue;
        };
        // The last non-empty segment that has a slash on both sides.
        let segments: Vec<&str> = prefix.split('/').collect();
        let inner = segments.get(1..segments.len().saturating_sub(1));
        let name = inner.and_then(|inner| inner.iter().rev().find(|segment| !segment.is_empty()));
        if let Some(name) = name {
            entries.push(ListEntry {
                name: (*name).to_owned(),
                id: None,
                created_at: None,
            });
        }
    }

    // /<Key>[^<]*\/([^/<]+)<\/Key>[\s\S]*?<LastModified>([^<]+)<\/LastModified>/g
    for contents in xml.split("<Contents>").skip(1) {
        let contents = contents.split("</Contents>").next().unwrap_or_default();
        // The key must have a path, and a name after it.
        let name = element(contents, "Key")
            .and_then(|key| key.rsplit_once('/'))
            .map(|(_, name)| name)
            .filter(|name| !name.is_empty());
        let created_at = element(contents, "LastModified").filter(|text| !text.is_empty());
        if let (Some(name), Some(created_at)) = (name, created_at) {
            entries.push(ListEntry {
                name: name.to_owned(),
                id: Some(name.to_owned()),
                created_at: Some(created_at.to_owned()),
            });
        }
    }
    entries
}

/// The text of the first `<tag>` element in `xml`.
fn element<'a>(xml: &'a str, tag: &str) -> Option<&'a str> {
    let (_, after) = xml.split_once(&format!("<{tag}>"))?;
    let (text, _) = after.split_once(&format!("</{tag}>"))?;
    Some(text)
}

#[cfg(test)]
mod tests {
    use super::super::{Backend, Storage, test_config};
    use super::*;

    #[test]
    fn r2_requests_go_to_the_account_endpoint_with_each_segment_encoded() {
        let storage = Storage::new(&test_config(&[
            ("R2_ACCOUNT_ID", "fixture-account"),
            ("R2_ACCESS_KEY_ID", "fixture-access-key"),
            ("R2_SECRET_ACCESS_KEY", "fixture-secret-key"),
            ("R2_BUCKET", "fixture-bucket"),
        ]))
        .unwrap();

        let Backend::R2(r2) = &storage.0.backend else {
            panic!("all four R2 values are set");
        };
        // The host lib/object-storage.ts sends to (tests/fixtures: r2.get.host).
        assert_eq!(
            r2.bucket_url,
            "https://fixture-account.r2.cloudflarestorage.com/fixture-bucket"
        );
        // No key that passes `safe_key` needs escaping; the rule is
        // encodeURIComponent per segment all the same.
        assert_eq!(
            r2.object_url("uploads/a b/\u{d55c}+\u{ae00}!~*'().png?x=1&y"),
            "https://fixture-account.r2.cloudflarestorage.com/fixture-bucket/uploads/a%20b/%ED%95%9C%2B%EA%B8%80!~*'().png%3Fx%3D1%26y"
        );
    }

    fn entry(name: &str, created_at: Option<&str>) -> ListEntry {
        ListEntry {
            name: name.to_owned(),
            id: created_at.map(|_| name.to_owned()),
            created_at: created_at.map(str::to_owned),
        }
    }

    #[test]
    fn parse_list_returns_folders_first_then_objects() {
        let xml = concat!(
            r#"<?xml version="1.0" encoding="UTF-8"?><ListBucketResult><Name>b</Name>"#,
            "<Prefix>uploads/2026/</Prefix><KeyCount>3</KeyCount><Delimiter>/</Delimiter>",
            "<Contents><Key>uploads/2026/a.png</Key>",
            "<LastModified>2026-11-23T08:02:11.123Z</LastModified><Size>3</Size></Contents>",
            "<Contents><Key>uploads/2026/b.png</Key>",
            "<LastModified>2026-11-23T08:02:12.000Z</LastModified><Size>4</Size></Contents>",
            "<CommonPrefixes><Prefix>uploads/2026/11/</Prefix></CommonPrefixes>",
            "</ListBucketResult>",
        );

        assert_eq!(
            parse_list(xml),
            [
                entry("11", None),
                entry("a.png", Some("2026-11-23T08:02:11.123Z")),
                entry("b.png", Some("2026-11-23T08:02:12.000Z")),
            ]
        );
    }

    #[test]
    fn parse_list_skips_what_the_typescript_patterns_skip() {
        let xml = concat!(
            // The echoed request prefix is not inside CommonPrefixes.
            "<Prefix>uploads/</Prefix>",
            // A key with no slash, and a folder marker ending in a slash.
            "<Contents><Key>top.png</Key><LastModified>2026-01-01T00:00:00.000Z</LastModified></Contents>",
            "<Contents><Key>uploads/dir/</Key><LastModified>2026-01-02T00:00:00.000Z</LastModified></Contents>",
            "<Contents><Key>uploads/kept.png</Key><LastModified>2026-01-03T00:00:00.000Z</LastModified></Contents>",
            // A top-level prefix has no slash before its name.
            "<CommonPrefixes><Prefix>uploads/</Prefix></CommonPrefixes>",
            "<CommonPrefixes><Prefix>uploads/sub/</Prefix></CommonPrefixes>",
        );

        assert_eq!(
            parse_list(xml),
            [
                entry("sub", None),
                entry("kept.png", Some("2026-01-03T00:00:00.000Z")),
            ]
        );
        assert_eq!(parse_list(""), []);
        assert_eq!(parse_list("<Key>uploads/a.png</Key>"), []);
    }

    #[test]
    fn parse_list_reads_contents_whose_children_come_in_another_order() {
        // As Versity S3 Gateway sends it: LastModified before Key.
        let xml = concat!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n",
            r#"<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">"#,
            "<Name>b</Name><Prefix>uploads/dir/</Prefix><KeyCount>2</KeyCount>",
            "<Contents><LastModified>2026-11-23T08:30:52Z</LastModified>",
            "<ETag>&#34;9dd4&#34;</ETag><Key>uploads/dir/a.txt</Key><Size>1</Size></Contents>",
            "<Contents><LastModified>2026-11-23T08:30:53Z</LastModified>",
            "<ETag>&#34;8cc3&#34;</ETag><Key>uploads/dir/b.txt</Key><Size>1</Size></Contents>",
            "</ListBucketResult>",
        );

        assert_eq!(
            parse_list(xml),
            [
                entry("a.txt", Some("2026-11-23T08:30:52Z")),
                entry("b.txt", Some("2026-11-23T08:30:53Z")),
            ]
        );
    }
}
