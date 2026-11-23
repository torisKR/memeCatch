//! Object storage, ported from `lib/object-storage.ts`: R2 over the S3 API when
//! all four `R2_*` values are set, otherwise a directory on local disk.
//!
//! Route code calls the methods on [`Storage`] (`state.storage`):
//!
//! | TypeScript | Rust |
//! | --- | --- |
//! | `from(bucket).upload(name, body, { contentType })` | [`Storage::put`] |
//! | `from(bucket).download(name)` | [`Storage::get`] |
//! | `from(bucket).remove([name])` | [`Storage::delete`], once per name |
//! | `from(bucket).list(prefix)` | [`Storage::list`] |
//! | `from(bucket).createSignedUrl(name, seconds)` | [`Storage::signed_object_url`] |
//! | `verifySignedObject(key, exp, sig)` | [`Storage::verify_signed_object`] |
//! | `readSignedObject(key)` | [`Storage::read_signed_object`] |
//!
//! Signed URLs are interchangeable with the TypeScript ones in both directions.
//! `tests/fixtures/object-storage-ts.json` holds what the TypeScript produces and
//! `parity/storage-parity.sh` checks both directions live.
//!
//! As in the TypeScript, the local backend does not store the content type,
//! `list` on R2 reads only the first page (1000 keys), and a failed R2 delete
//! is not an error (here it is logged).
//!
//! Where this differs from the TypeScript on purpose:
//!
//! - [`Storage::read_signed_object`] reads the cleaned key. The TypeScript
//!   checks the key and then reads it as given, so a signed `../x` leaves the
//!   storage root there. Keys the application signs are already clean.
//! - [`Storage::list`] on R2 reads each `<Contents>` whatever the order of its
//!   children. The TypeScript needs `<Key>` before `<LastModified>`.
//! - With `NEXT_PUBLIC_SITE_URL` unset, signed URLs start with the `Config`
//!   default (`https://catchmeme.com`); the TypeScript uses
//!   `http://localhost:3000`. Compose always sets the variable.

use std::fmt;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use aws_credential_types::Credentials;
use aws_sigv4::http_request::{
    PayloadChecksumKind, PercentEncodingMode, SignableBody, SignableRequest, SigningSettings,
    UriPathNormalizationMode, sign,
};
use aws_sigv4::sign::v4;
use axum::body::{Body, Bytes};
use axum::http::header::{CONTENT_TYPE, HeaderValue};
use axum::http::{Method, Request, Response, StatusCode};
use hmac::{Hmac, KeyInit, Mac};
use hyper_rustls::{HttpsConnector, HttpsConnectorBuilder};
use hyper_util::client::legacy::Client;
use hyper_util::client::legacy::connect::HttpConnector;
use hyper_util::rt::TokioExecutor;
use percent_encoding::{AsciiSet, NON_ALPHANUMERIC, utf8_percent_encode};
use serde::Serialize;
use sha2::Sha256;
use time::OffsetDateTime;

use crate::config::{Config, Secret};

const DEFAULT_CONTENT_TYPE: &str = "application/octet-stream";
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

#[derive(Debug)]
pub enum StorageError {
    /// A bucket, name or key that `safe_key` rejects.
    InvalidKey,
    /// R2 answered with a status that is not a success.
    Status(StatusCode),
    /// The request to R2 could not be signed, sent or read.
    Transport(String),
    /// The local directory could not be read or written.
    Io(std::io::Error),
}

impl fmt::Display for StorageError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidKey => f.write_str("invalid object key"),
            Self::Status(status) => write!(f, "object storage answered {status}"),
            Self::Transport(message) => write!(f, "object storage request failed: {message}"),
            Self::Io(error) => write!(f, "local object storage failed: {error}"),
        }
    }
}

impl std::error::Error for StorageError {}

/// The bytes of one object and its content type.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StoredObject {
    pub bytes: Bytes,
    pub content_type: String,
}

/// One `list` entry, with the field names the TypeScript returns. A folder has
/// no `id` and no `created_at`.
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct ListEntry {
    pub name: String,
    pub id: Option<String>,
    pub created_at: Option<String>,
}

/// Drops empty, `.` and `..` segments and joins the rest with `/`. Every
/// remaining segment must match `[A-Za-z0-9_.-]+` (JavaScript `[\w.-]+`), and
/// at least one must remain.
pub fn safe_key(value: &str) -> Result<String, StorageError> {
    let parts: Vec<&str> = value
        .split('/')
        .filter(|part| !matches!(*part, "" | "." | ".."))
        .collect();
    let is_safe = |part: &&str| {
        part.bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'))
    };
    if parts.is_empty() || !parts.iter().all(is_safe) {
        return Err(StorageError::InvalidKey);
    }
    Ok(parts.join("/"))
}

/// The storage key of `name` in `bucket`: `<safe bucket>/<safe name>`.
pub fn object_key(bucket: &str, name: &str) -> Result<String, StorageError> {
    Ok(format!("{}/{}", safe_key(bucket)?, safe_key(name)?))
}

/// Held in `AppState` as `state.storage`. Cheap to clone.
#[derive(Clone)]
pub struct Storage(Arc<Inner>);

struct Inner {
    /// `OBJECT_SIGNING_SECRET`, or `BETTER_AUTH_SECRET` when that is not set.
    signing_secret: Secret,
    /// `NEXT_PUBLIC_SITE_URL` without trailing slashes.
    site_url: String,
    backend: Backend,
}

enum Backend {
    Local { root: PathBuf },
    R2(Box<R2>),
}

impl Storage {
    pub fn new(config: &Config) -> Result<Self, String> {
        let endpoint = config
            .r2
            .as_ref()
            .map(|r2| format!("https://{}.r2.cloudflarestorage.com", r2.account_id));
        Self::build(config, endpoint.as_deref())
    }

    /// For tests only: sends the S3 requests to `endpoint` (for example
    /// `http://127.0.0.1:9000`), not to Cloudflare. No environment variable
    /// reaches this.
    #[doc(hidden)]
    pub fn with_r2_endpoint(config: &Config, endpoint: &str) -> Result<Self, String> {
        Self::build(config, Some(endpoint.trim_end_matches('/')))
    }

    fn build(config: &Config, endpoint: Option<&str>) -> Result<Self, String> {
        let backend = match (&config.r2, endpoint) {
            (Some(r2), Some(endpoint)) => Backend::R2(Box::new(R2::new(
                Credentials::new(
                    r2.access_key_id.as_str(),
                    r2.secret_access_key.expose(),
                    None,
                    None,
                    "memecatch-config",
                ),
                format!("{endpoint}/{}", r2.bucket),
            )?)),
            _ => Backend::Local {
                root: PathBuf::from(&config.local_object_storage_dir),
            },
        };
        Ok(Self(Arc::new(Inner {
            signing_secret: config
                .object_signing_secret
                .clone()
                .unwrap_or_else(|| config.better_auth_secret.clone()),
            site_url: config.site_url.trim_end_matches('/').to_owned(),
            backend,
        })))
    }

    /// `<site>/api/media/signed?key=..&exp=..&sig=..`, valid for
    /// `expires_in_secs` seconds from now.
    pub fn signed_object_url(
        &self,
        bucket: &str,
        path: &str,
        expires_in_secs: u64,
    ) -> Result<String, StorageError> {
        self.signed_object_url_at(bucket, path, expires_in_secs, now_ms())
    }

    /// [`Self::signed_object_url`] with the clock as an argument
    /// (`now_ms`: milliseconds since the Unix epoch).
    pub fn signed_object_url_at(
        &self,
        bucket: &str,
        path: &str,
        expires_in_secs: u64,
        now_ms: u64,
    ) -> Result<String, StorageError> {
        let exp = now_ms.saturating_add(expires_in_secs.saturating_mul(1000));
        let key = object_key(bucket, path)?;
        let sig = hex::encode(self.mac(&key, &exp.to_string()).finalize().into_bytes());
        Ok(format!(
            "{}/api/media/signed?key={}&exp={exp}&sig={sig}",
            self.0.site_url,
            form_encode_key(&key)
        ))
    }

    /// Whether `sig` signs `key` until `exp`, and `exp` has not passed. The
    /// arguments are the decoded query values of a signed URL.
    pub fn verify_signed_object(&self, key: &str, exp: &str, sig: &str) -> bool {
        self.verify_signed_object_at(key, exp, sig, now_ms())
    }

    /// [`Self::verify_signed_object`] with the clock as an argument.
    pub fn verify_signed_object_at(&self, key: &str, exp: &str, sig: &str, now_ms: u64) -> bool {
        // The TypeScript reads `exp` with `Number(exp)` and signs the number
        // printed back, so `" 1764000000000 "` and `1.764e12` name the same
        // expiry as `1764000000000`.
        let expires = match js_number(exp) {
            Some(expires) if expires.is_finite() && expires >= now_ms as f64 => expires,
            _ => return false,
        };
        // The TypeScript compares the hex text, so only 64 lowercase hex digits
        // can match. The format check does not depend on the secret; the
        // comparison of the decoded bytes is constant-time.
        let is_lower_hex = |byte: u8| matches!(byte, b'0'..=b'9' | b'a'..=b'f');
        if sig.len() != 64 || !sig.bytes().all(is_lower_hex) {
            return false;
        }
        let Ok(sig) = hex::decode(sig) else {
            return false;
        };
        self.mac(key, &js_number_to_string(expires))
            .verify_slice(&sig)
            .is_ok()
    }

    /// The object a signed URL names. `Ok(None)`: no such object.
    ///
    /// Reads `safe_key(key)`. For a key that is not in that form already (a
    /// leading or doubled slash, `.` or `..` segments) the TypeScript reads the
    /// key as given, and `..` walks out of the storage root there. Only the
    /// holder of the signing secret can sign such a key.
    pub async fn read_signed_object(
        &self,
        key: &str,
    ) -> Result<Option<StoredObject>, StorageError> {
        self.read(&safe_key(key)?).await
    }

    /// The object `name` in `bucket`. `Ok(None)`: no such object.
    pub async fn get(
        &self,
        bucket: &str,
        name: &str,
    ) -> Result<Option<StoredObject>, StorageError> {
        self.read(&object_key(bucket, name)?).await
    }

    /// Stores `bytes` as `name` in `bucket`, replacing what is there.
    /// `content_type` defaults to `application/octet-stream`; only R2 keeps it.
    pub async fn put(
        &self,
        bucket: &str,
        name: &str,
        bytes: Bytes,
        content_type: Option<&str>,
    ) -> Result<(), StorageError> {
        let key = object_key(bucket, name)?;
        match &self.0.backend {
            Backend::R2(r2) => {
                let content_type = content_type.unwrap_or(DEFAULT_CONTENT_TYPE);
                let response = r2
                    .send(Method::PUT, &r2.object_url(&key), Some(content_type), bytes)
                    .await?;
                ok_status(response.status())
            }
            Backend::Local { root } => {
                let file = root.join(key);
                if let Some(parent) = file.parent() {
                    tokio::fs::create_dir_all(parent)
                        .await
                        .map_err(StorageError::Io)?;
                }
                tokio::fs::write(file, bytes)
                    .await
                    .map_err(StorageError::Io)
            }
        }
    }

    /// Removes `name` from `bucket`. A missing object is not an error.
    pub async fn delete(&self, bucket: &str, name: &str) -> Result<(), StorageError> {
        let key = object_key(bucket, name)?;
        match &self.0.backend {
            Backend::R2(r2) => {
                let response = r2
                    .send(Method::DELETE, &r2.object_url(&key), None, Bytes::new())
                    .await?;
                // The TypeScript does not look at the status of a DELETE, so
                // callers see success here too. Log it so it is not silent.
                if !response.status().is_success() {
                    tracing::warn!(status = %response.status(), key, "R2 delete was not successful");
                }
                Ok(())
            }
            Backend::Local { root } => match tokio::fs::remove_file(root.join(key)).await {
                Err(error) if error.kind() != std::io::ErrorKind::NotFound => {
                    Err(StorageError::Io(error))
                }
                _ => Ok(()),
            },
        }
    }

    /// The objects and folders directly under `prefix` in `bucket` (`""`: the
    /// bucket itself). Folders have no `id` and no `created_at`.
    pub async fn list(&self, bucket: &str, prefix: &str) -> Result<Vec<ListEntry>, StorageError> {
        let mut key = safe_key(bucket)?;
        if !prefix.is_empty() {
            key = format!("{key}/{}", safe_key(prefix)?);
        }
        match &self.0.backend {
            Backend::R2(r2) => {
                let url = format!(
                    "{}?list-type=2&prefix={}%2F&delimiter=%2F",
                    r2.bucket_url,
                    form_encode_key(&key)
                );
                let response = r2.send(Method::GET, &url, None, Bytes::new()).await?;
                ok_status(response.status())?;
                Ok(parse_list(&String::from_utf8_lossy(response.body())))
            }
            Backend::Local { root } => list_local(root.join(key)).await,
        }
    }

    async fn read(&self, key: &str) -> Result<Option<StoredObject>, StorageError> {
        match &self.0.backend {
            Backend::R2(r2) => {
                let response = r2
                    .send(Method::GET, &r2.object_url(key), None, Bytes::new())
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
            // As in the TypeScript, a file that cannot be read for any reason
            // counts as missing.
            Backend::Local { root } => {
                Ok(tokio::fs::read(root.join(key))
                    .await
                    .ok()
                    .map(|bytes| StoredObject {
                        bytes: bytes.into(),
                        content_type: DEFAULT_CONTENT_TYPE.to_owned(),
                    }))
            }
        }
    }

    /// HMAC-SHA256 over `"<key>:<exp>"`.
    fn mac(&self, key: &str, exp: &str) -> Hmac<Sha256> {
        let mut mac = Hmac::<Sha256>::new_from_slice(self.0.signing_secret.expose().as_bytes())
            .expect("HMAC accepts a key of any length");
        mac.update(format!("{key}:{exp}").as_bytes());
        mac
    }
}

fn now_ms() -> u64 {
    let since_epoch = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    u64::try_from(since_epoch.as_millis()).unwrap_or(u64::MAX)
}

fn ok_status(status: StatusCode) -> Result<(), StorageError> {
    if status.is_success() {
        Ok(())
    } else {
        Err(StorageError::Status(status))
    }
}

/// `URLSearchParams` encoding of a key that passed `safe_key`: of the
/// characters such a key can hold, only `/` is escaped.
fn form_encode_key(key: &str) -> String {
    key.replace('/', "%2F")
}

/// JavaScript `Number(text)`. `None` is `NaN`.
fn js_number(text: &str) -> Option<f64> {
    // JavaScript trims U+FEFF and does not trim U+0085; Rust has it the other
    // way round.
    let is_js_whitespace = |c: char| (c.is_whitespace() && c != '\u{85}') || c == '\u{feff}';
    let text = text.trim_matches(is_js_whitespace);
    if text.is_empty() {
        return Some(0.0);
    }
    let radix = match text.get(..2) {
        Some("0x" | "0X") => Some(16),
        Some("0o" | "0O") => Some(8),
        Some("0b" | "0B") => Some(2),
        _ => None,
    };
    if let Some(radix) = radix {
        let digits = &text[2..];
        // `from_str_radix` alone would also take a leading `+`.
        if digits.is_empty() || !digits.chars().all(|c| c.is_digit(radix)) {
            return None;
        }
        // A literal above 2^128 is a number in JavaScript and NaN here. As a
        // millisecond timestamp, 2^128 is not a date.
        return u128::from_str_radix(digits, radix)
            .ok()
            .map(|value| value as f64);
    }
    // Rust and JavaScript read the same decimal literals. They spell infinity
    // and NaN differently, and the caller rejects both.
    text.parse().ok()
}

/// JavaScript `String(value)` for a finite value that is at least the current
/// time in milliseconds. (Below 1e-6 JavaScript switches to exponent notation
/// and this does not.)
fn js_number_to_string(value: f64) -> String {
    if value >= 1e21 {
        format!("{value:e}").replace('e', "e+")
    } else {
        format!("{value}")
    }
}

/// Node's `stats.mtime.toISOString()`.
fn js_mtime_iso(modified: SystemTime) -> Option<String> {
    // Node computes `sec * 1e3 + nsec / 1e6` in doubles and rounds to a whole
    // millisecond with `Math.round`. The same arithmetic gives the same result.
    let as_ms = |d: Duration| d.as_secs() as f64 * 1e3 + f64::from(d.subsec_nanos()) / 1e6;
    let ms = match modified.duration_since(UNIX_EPOCH) {
        Ok(after) => as_ms(after),
        Err(before) => -as_ms(before.duration()),
    };
    let ms = (ms + 0.5).floor() as i128;
    let format = time::format_description::parse_borrowed::<3>(
        "[year]-[month]-[day]T[hour]:[minute]:[second].[subsecond digits:3]Z",
    )
    .ok()?;
    OffsetDateTime::from_unix_timestamp_nanos(ms * 1_000_000)
        .ok()?
        .format(&format)
        .ok()
}

async fn list_local(base: PathBuf) -> Result<Vec<ListEntry>, StorageError> {
    // A directory that cannot be read lists as empty, as in the TypeScript.
    let Ok(mut dir) = tokio::fs::read_dir(&base).await else {
        return Ok(Vec::new());
    };
    let mut names = Vec::new();
    loop {
        match dir.next_entry().await {
            Ok(Some(entry)) => names.push(entry.file_name().to_string_lossy().into_owned()),
            Ok(None) => break,
            Err(_) => return Ok(Vec::new()),
        }
    }
    // JavaScript sorts strings by UTF-16 code unit.
    names.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
    let mut entries = Vec::with_capacity(names.len());
    for name in names {
        let info = tokio::fs::metadata(base.join(&name))
            .await
            .map_err(StorageError::Io)?;
        let is_file = info.is_file();
        entries.push(ListEntry {
            id: is_file.then(|| name.clone()),
            created_at: if is_file {
                info.modified().ok().and_then(js_mtime_iso)
            } else {
                None
            },
            name,
        });
    }
    Ok(entries)
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

/// R2 through its S3 API, signed with SigV4 (`region=auto`, `service=s3`).
struct R2 {
    client: Client<HttpsConnector<HttpConnector>, Body>,
    credentials: Credentials,
    /// `<endpoint>/<bucket>`.
    bucket_url: String,
}

impl R2 {
    fn new(credentials: Credentials, bucket_url: String) -> Result<Self, String> {
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
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(extra: &[(&str, &str)]) -> Config {
        Config::from_lookup(|name| {
            [
                ("DATABASE_URL", "postgresql://u:p@127.0.0.1/db"),
                ("BETTER_AUTH_SECRET", "s"),
            ]
            .iter()
            .chain(extra)
            .find(|(key, _)| *key == name)
            .map(|(_, value)| (*value).to_owned())
        })
        .expect("valid config")
    }

    #[test]
    fn r2_requests_go_to_the_account_endpoint_with_each_segment_encoded() {
        let storage = Storage::new(&config(&[
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

    #[test]
    fn without_r2_values_the_local_directory_is_used() {
        let default = Storage::new(&config(&[])).unwrap();
        let chosen =
            Storage::new(&config(&[("LOCAL_OBJECT_STORAGE_DIR", "/srv/objects")])).unwrap();

        let root = |storage: &Storage| match &storage.0.backend {
            Backend::Local { root } => root.clone(),
            Backend::R2(_) => panic!("no R2 values are set"),
        };
        assert_eq!(root(&default), PathBuf::from("/tmp/memecatch-objects"));
        assert_eq!(root(&chosen), PathBuf::from("/srv/objects"));
    }

    #[test]
    fn js_number_reads_what_number_reads() {
        for (text, expected) in [
            ("1764000000000", Some(1764000000000.0)),
            (" \t1764000000000\n", Some(1764000000000.0)),
            ("\u{feff}12\u{a0}", Some(12.0)),
            ("1.764e12", Some(1764000000000.0)),
            ("+.5", Some(0.5)),
            ("5.", Some(5.0)),
            ("", Some(0.0)),
            ("   ", Some(0.0)),
            ("0x1F", Some(31.0)),
            ("0o17", Some(15.0)),
            ("0B11", Some(3.0)),
            ("0x", None),
            ("0x+1F", None),
            ("-0x1F", None),
            ("12abc", None),
            ("1_000", None),
            ("\u{85}12", None),
            (".", None),
            ("e5", None),
        ] {
            assert_eq!(js_number(text), expected, "{text:?}");
        }
        // Spelled differently in the two languages; never finite in either.
        for text in ["Infinity", "-Infinity", "inf", "nan", "NaN", "1e400"] {
            assert!(!js_number(text).is_some_and(f64::is_finite), "{text:?}");
        }
    }

    #[test]
    fn js_number_to_string_prints_what_string_prints() {
        for (value, expected) in [
            (1764000000000.0, "1764000000000"),
            (1764000000000.5, "1764000000000.5"),
            (12345678901234567890.0, "12345678901234567000"),
            (1e21, "1e+21"),
            (1.5e21, "1.5e+21"),
            (1.2345e300, "1.2345e+300"),
        ] {
            assert_eq!(js_number_to_string(value), expected);
        }
    }

    #[test]
    fn js_mtime_iso_rounds_to_the_millisecond_like_node() {
        let at = |secs, nanos| UNIX_EPOCH + Duration::new(secs, nanos);

        for (modified, expected) in [
            (at(1_764_000_000, 0), "2025-11-24T16:00:00.000Z"),
            (at(1_764_000_000, 123_456_789), "2025-11-24T16:00:00.123Z"),
            (at(1_764_000_000, 123_500_000), "2025-11-24T16:00:00.124Z"),
            (at(1_764_000_000, 999_500_000), "2025-11-24T16:00:01.000Z"),
            (at(0, 0), "1970-01-01T00:00:00.000Z"),
        ] {
            assert_eq!(js_mtime_iso(modified).as_deref(), Some(expected));
        }
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
