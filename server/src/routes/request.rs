//! What several ported handlers read from a request, with the semantics of
//! the TypeScript they replace: the `Origin` check, a body with a size limit,
//! `JSON.parse`, `URLSearchParams` and `decodeURIComponent`.

use std::collections::HashMap;
use std::collections::hash_map::Entry;

use axum::body::Body;
use axum::extract::FromRequestParts;
use axum::http::header::{CONTENT_TYPE, HeaderMap, HeaderName, ORIGIN};
use axum::http::request::Parts;
use axum::http::{StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use futures_util::StreamExt;
use serde::de::{Deserialize, Deserializer, MapAccess, SeqAccess, Visitor};
use url::Url;

use crate::AppState;
use crate::auth::{RequestIdentity, SessionUser};
use crate::routes::public::csp_report;

/// The user `createClient()` of lib/db/server.ts gives a route: the user of
/// the session cookie, or none. A session that cannot be looked up counts as
/// signed out there (`currentSession().catch(() => null)`), so it does here;
/// the extractor on its own would answer 503.
pub async fn session_user(state: &AppState, parts: &mut Parts) -> Option<SessionUser> {
    match RequestIdentity::from_request_parts(parts, state).await {
        Ok(RequestIdentity(user)) => user,
        Err(_) => None,
    }
}

/// `new URL(SITE_URL).origin`, with `SITE_URL` as `lib/site.ts` defines it.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SiteOrigin(String);

impl SiteOrigin {
    /// `site_url` is `NEXT_PUBLIC_SITE_URL` or its default. `None` when it is
    /// not an absolute URL: `new URL` throws there, and each route answers
    /// that in its own way, so those routes are left to Next.
    pub fn from_site_url(site_url: &str) -> Option<Self> {
        // `.replace(/\/+$/, "")` in lib/site.ts.
        let url = Url::parse(site_url.trim_end_matches('/')).ok()?;
        Some(Self(url.origin().ascii_serialization()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

/// Where a request says it comes from.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RequestOrigin {
    /// No `Origin` header, or an empty one (`""` is falsy in the TypeScript).
    Absent,
    /// The origin of `SITE_URL`.
    Site,
    /// Any other origin: not trusted.
    Other,
}

pub fn request_origin(headers: &HeaderMap, site: &SiteOrigin) -> RequestOrigin {
    match header_text(headers, &ORIGIN, ", ") {
        None => RequestOrigin::Absent,
        Some(origin) if origin.is_empty() => RequestOrigin::Absent,
        Some(origin) if origin == site.as_str() => RequestOrigin::Site,
        Some(_) => RequestOrigin::Other,
    }
}

/// `hasTrustedOrigin`: true for the site's origin or, without an origin, a
/// same-origin fetch; false for anything else.
pub fn trusted_origin(headers: &HeaderMap, site: &SiteOrigin) -> bool {
    match request_origin(headers, site) {
        RequestOrigin::Site => true,
        RequestOrigin::Other => false,
        RequestOrigin::Absent => {
            let fetch_site = HeaderName::from_static("sec-fetch-site");
            header_text(headers, &fetch_site, ", ").as_deref() == Some("same-origin")
        }
    }
}

/// `request.headers.get(name)`: the values of a repeated header joined with
/// `separator` (Node uses `"; "` for `Cookie` and `", "` for the rest), each
/// byte one character (Latin-1), as Node hands header text to Next.
pub fn header_text(headers: &HeaderMap, name: &HeaderName, separator: &str) -> Option<String> {
    let mut values = headers.get_all(name).iter().peekable();
    values.peek()?;
    let text: Vec<String> = values
        .map(|value| {
            value
                .as_bytes()
                .iter()
                .map(|&byte| char::from(byte))
                .collect()
        })
        .collect();
    Some(text.join(separator))
}

/// False for a request target with a byte outside ASCII, which
/// `standalone::before_routing` answers with 400 before any route runs.
pub fn has_ascii_target(uri: &Uri) -> bool {
    uri.path_and_query()
        .is_none_or(|target| target.as_str().is_ascii())
}

/// `[...new URL(request.url).searchParams]`: the query as decoded pairs.
pub fn query_pairs(uri: &Uri) -> Vec<(String, String)> {
    url::form_urlencoded::parse(uri.query().unwrap_or_default().as_bytes())
        .into_owned()
        .collect()
}

/// `URLSearchParams.get`: the first value of that name.
pub fn first_param<'a>(pairs: &'a [(String, String)], name: &str) -> Option<&'a str> {
    pairs
        .iter()
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.as_str())
}

/// `Response.json(...)` with a body that is already JSON text.
pub fn json(status: StatusCode, body: impl Into<Body>) -> Response {
    (status, [(CONTENT_TYPE, "application/json")], body.into()).into_response()
}

#[derive(Debug, PartialEq, Eq)]
pub enum BodyError {
    /// `RequestBodyTooLargeError`: declared or read past the limit.
    TooLarge,
    /// The body could not be read to its end.
    Unreadable,
}

/// `readBoundedText` in lib/request-body.ts: the body as text, refused when
/// `Content-Length` declares more than `max_bytes` or more than that arrives.
pub async fn read_bounded_text(
    headers: &HeaderMap,
    body: Body,
    max_bytes: usize,
) -> Result<String, BodyError> {
    if csp_report::declares_too_large(headers, max_bytes) {
        return Err(BodyError::TooLarge);
    }
    let bytes = read_at_most(body, max_bytes).await?;
    Ok(decode_text(&bytes))
}

/// Reads the body, giving up as soon as it is longer than `max_bytes`, so at
/// most one chunk more than the limit is ever held.
pub async fn read_at_most(body: Body, max_bytes: usize) -> Result<Vec<u8>, BodyError> {
    let mut stream = body.into_data_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| BodyError::Unreadable)?;
        if bytes.len() + chunk.len() > max_bytes {
            return Err(BodyError::TooLarge);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

/// `TextDecoder`: invalid bytes become U+FFFD and one leading BOM is dropped.
pub fn decode_text(bytes: &[u8]) -> String {
    let decoded = String::from_utf8_lossy(bytes);
    decoded
        .strip_prefix('\u{feff}')
        .unwrap_or(&decoded)
        .to_owned()
}

/// A `JSON.parse` result. Objects keep their keys in the order JavaScript
/// lists them (`Object.keys`, `Object.entries`): first appearance, with a
/// repeated key holding its last value. (JavaScript lists keys that look like
/// array indices first; no ported route reads those.)
///
/// `serde_json` refuses three inputs `JSON.parse` accepts: a string with an
/// unpaired `\uD800`-style escape, a number too large for a double (`1e999`)
/// and a document nested deeper than 128 levels. A route then answers as for
/// malformed JSON.
#[derive(Clone, Debug, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Json>),
    Object(Vec<(String, Json)>),
}

impl Json {
    pub fn parse(text: &str) -> Option<Self> {
        serde_json::from_str(text).ok()
    }

    /// The entries of a non-null, non-array object
    /// (`value && typeof value === "object" && !Array.isArray(value)`).
    pub fn as_object(&self) -> Option<&[(String, Json)]> {
        match self {
            Self::Object(entries) => Some(entries),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::String(text) => Some(text),
            _ => None,
        }
    }
}

/// `object[key]` for an own property; `None` is `undefined`.
pub fn property<'a>(entries: &'a [(String, Json)], key: &str) -> Option<&'a Json> {
    entries
        .iter()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value)
}

impl<'de> Deserialize<'de> for Json {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        deserializer.deserialize_any(JsonVisitor)
    }
}

struct JsonVisitor;

impl<'de> Visitor<'de> for JsonVisitor {
    type Value = Json;

    fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
        formatter.write_str("any JSON value")
    }

    fn visit_unit<E>(self) -> Result<Json, E> {
        Ok(Json::Null)
    }

    fn visit_bool<E>(self, value: bool) -> Result<Json, E> {
        Ok(Json::Bool(value))
    }

    // Every JavaScript number is a double.
    fn visit_i64<E>(self, value: i64) -> Result<Json, E> {
        Ok(Json::Number(value as f64))
    }

    fn visit_u64<E>(self, value: u64) -> Result<Json, E> {
        Ok(Json::Number(value as f64))
    }

    fn visit_f64<E>(self, value: f64) -> Result<Json, E> {
        Ok(Json::Number(value))
    }

    fn visit_str<E>(self, value: &str) -> Result<Json, E> {
        Ok(Json::String(value.to_owned()))
    }

    fn visit_string<E>(self, value: String) -> Result<Json, E> {
        Ok(Json::String(value))
    }

    fn visit_seq<A: SeqAccess<'de>>(self, mut items: A) -> Result<Json, A::Error> {
        let mut array = Vec::new();
        while let Some(item) = items.next_element()? {
            array.push(item);
        }
        Ok(Json::Array(array))
    }

    fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> Result<Json, A::Error> {
        // `JSON.parse`: a repeated key keeps its first place and its last
        // value. The index makes that linear in the number of keys.
        let mut entries: Vec<(String, Json)> = Vec::new();
        let mut index: HashMap<String, usize> = HashMap::new();
        while let Some((key, value)) = map.next_entry::<String, Json>()? {
            match index.entry(key) {
                Entry::Occupied(seen) => entries[*seen.get()].1 = value,
                Entry::Vacant(new) => {
                    entries.push((new.key().clone(), value));
                    new.insert(entries.len() - 1);
                }
            }
        }
        Ok(Json::Object(entries))
    }
}

/// `decodeURIComponent`. `None` where JavaScript throws `URIError`: a `%`
/// not followed by two hex digits, or escapes that are not UTF-8.
pub fn decode_uri_component(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let escape = |at: usize| -> Option<u8> {
        let hex = |index: usize| char::from(*bytes.get(index)?).to_digit(16);
        if bytes.get(at) != Some(&b'%') {
            return None;
        }
        u8::try_from(hex(at + 1)? * 16 + hex(at + 2)?).ok()
    };
    let mut decoded = String::with_capacity(text.len());
    let mut at = 0;
    while at < bytes.len() {
        if bytes[at] != b'%' {
            let character = text[at..].chars().next()?;
            decoded.push(character);
            at += character.len_utf8();
            continue;
        }
        let first = escape(at)?;
        let length = match first {
            0x00..=0x7f => 1,
            0xc0..=0xdf => 2,
            0xe0..=0xef => 3,
            0xf0..=0xf7 => 4,
            _ => return None,
        };
        // Every byte of one character must be an escape of its own.
        let sequence: Vec<u8> = (0..length)
            .map(|index| escape(at + 3 * index))
            .collect::<Option<_>>()?;
        decoded.push_str(std::str::from_utf8(&sequence).ok()?);
        at += 3 * length;
    }
    Some(decoded)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    type HeaderPairs = [(&'static str, &'static [u8])];

    fn headers(pairs: &HeaderPairs) -> HeaderMap {
        let mut headers = HeaderMap::new();
        for (name, value) in pairs {
            headers.append(*name, HeaderValue::from_bytes(value).unwrap());
        }
        headers
    }

    // Expected values are what Node prints for new URL(input).origin.
    #[test]
    fn site_origin_is_the_whatwg_origin_of_the_site_url() {
        let origin = |site_url: &str| SiteOrigin::from_site_url(site_url).map(|origin| origin.0);

        assert_eq!(
            origin("https://catchmeme.com").as_deref(),
            Some("https://catchmeme.com")
        );
        assert_eq!(
            origin("HTTPS://CatchMeme.com:443/path///").as_deref(),
            Some("https://catchmeme.com")
        );
        assert_eq!(
            origin("http://127.0.0.1:3001").as_deref(),
            Some("http://127.0.0.1:3001")
        );
        assert_eq!(
            origin("https://밈.example").as_deref(),
            Some("https://xn--xg3b.example")
        );
        // `new URL` throws on these.
        assert_eq!(origin(""), None);
        assert_eq!(origin("catchmeme.com"), None);
        assert_eq!(origin("///"), None);
    }

    #[test]
    fn origin_is_absent_site_or_other() {
        let site = SiteOrigin::from_site_url("https://catchmeme.com").unwrap();
        let origin = |pairs: &HeaderPairs| request_origin(&headers(pairs), &site);

        assert_eq!(origin(&[]), RequestOrigin::Absent);
        assert_eq!(origin(&[("origin", b"")]), RequestOrigin::Absent);
        assert_eq!(
            origin(&[("origin", b"https://catchmeme.com")]),
            RequestOrigin::Site
        );
        for other in [
            &b"https://catchmeme.com/"[..],
            b"http://catchmeme.com",
            b"https://CatchMeme.com",
            b"https://www.catchmeme.com",
            b"https://localhost:3000",
            b"null",
            b"https://catchmeme.com\xff",
        ] {
            let mut headers = HeaderMap::new();
            headers.insert("origin", HeaderValue::from_bytes(other).unwrap());
            assert_eq!(request_origin(&headers, &site), RequestOrigin::Other);
        }
        // Two Origin headers read as one value, "a, b".
        assert_eq!(
            origin(&[
                ("origin", b"https://catchmeme.com"),
                ("origin", b"https://catchmeme.com")
            ]),
            RequestOrigin::Other
        );
    }

    #[test]
    fn header_text_joins_repeats_and_reads_bytes_as_latin_1() {
        let cookies = headers(&[("cookie", b"a=1"), ("cookie", b"b=\xe9")]);

        assert_eq!(
            header_text(&cookies, &HeaderName::from_static("cookie"), "; ").as_deref(),
            Some("a=1; b=\u{e9}")
        );
        assert_eq!(
            header_text(&cookies, &HeaderName::from_static("origin"), ", "),
            None
        );
    }

    #[test]
    fn target_with_a_raw_non_ascii_byte_is_not_parsed_here() {
        assert!(has_ascii_target(&Uri::from_static(
            "/api/quiz?set=%EB%B0%88"
        )));
        let raw = Uri::try_from("/api/quiz?set=밈".as_bytes());
        assert!(raw.is_ok_and(|uri| !has_ascii_target(&uri)));
    }

    // Expected values are what Node prints for
    // [...new URL("http://x" + target).searchParams].
    #[test]
    fn query_pairs_follow_url_search_params() {
        let pairs = |target: &'static str| query_pairs(&Uri::from_static(target));
        let owned = |list: &[(&str, &str)]| -> Vec<(String, String)> {
            list.iter()
                .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
                .collect()
        };

        assert_eq!(pairs("/a"), owned(&[]));
        assert_eq!(pairs("/a?"), owned(&[]));
        assert_eq!(
            pairs("/a?page=2&query=a+b%20c&query=&x"),
            owned(&[("page", "2"), ("query", "a b c"), ("query", ""), ("x", "")])
        );
        assert_eq!(
            pairs("/a?q=%EB%B0%88&bad=%ff%zz&=v&&k=a=b"),
            owned(&[("q", "밈"), ("bad", "\u{fffd}%zz"), ("", "v"), ("k", "a=b")])
        );
        let list = pairs("/a?page=1&page=2");
        assert_eq!(first_param(&list, "page"), Some("1"));
        assert_eq!(first_param(&list, "query"), None);
    }

    fn chunks(parts: &'static [&'static str]) -> Body {
        Body::from_stream(futures_util::stream::iter(
            parts
                .iter()
                .map(|part| Ok::<_, std::convert::Infallible>(*part)),
        ))
    }

    #[tokio::test]
    async fn body_over_the_limit_is_refused_declared_or_not() {
        let none = HeaderMap::new();
        let declared = |length: &'static [u8]| headers(&[("content-length", length)]);

        assert_eq!(
            read_bounded_text(&none, Body::from("12345678"), 8)
                .await
                .as_deref(),
            Ok("12345678")
        );
        assert_eq!(
            read_bounded_text(&none, Body::empty(), 8).await.as_deref(),
            Ok("")
        );
        assert_eq!(
            read_bounded_text(&none, Body::from("123456789"), 8).await,
            Err(BodyError::TooLarge)
        );
        assert_eq!(
            read_bounded_text(&none, chunks(&["1234", "5678", "9"]), 8).await,
            Err(BodyError::TooLarge)
        );
        // The declared length alone decides, before a byte is read.
        assert_eq!(
            read_bounded_text(&declared(b"9"), Body::from("1"), 8).await,
            Err(BodyError::TooLarge)
        );
        assert_eq!(
            read_bounded_text(&declared(b"12a"), Body::from("1"), 8).await,
            Err(BodyError::TooLarge)
        );
        assert_eq!(
            read_bounded_text(&declared(b"8"), chunks(&["1234", "5678"]), 8)
                .await
                .as_deref(),
            Ok("12345678")
        );
    }

    #[test]
    fn text_is_decoded_like_text_decoder() {
        assert_eq!(decode_text(b"\xef\xbb\xbf{\"a\":1}"), "{\"a\":1}");
        assert_eq!(decode_text(b"a\xffb\xc3"), "a\u{fffd}b\u{fffd}");
        // Only the first BOM goes.
        assert_eq!(decode_text("\u{feff}\u{feff}x".as_bytes()), "\u{feff}x");
    }

    #[test]
    fn json_objects_keep_javascript_key_order_and_the_last_duplicate() {
        let parsed = Json::parse(r#"{"b":1,"a":"x","b":[true,null],"c":{"d":1.5}}"#).unwrap();
        let entries = parsed.as_object().unwrap();

        let keys: Vec<&str> = entries.iter().map(|(key, _)| key.as_str()).collect();
        assert_eq!(keys, ["b", "a", "c"]);
        assert_eq!(
            property(entries, "b"),
            Some(&Json::Array(vec![Json::Bool(true), Json::Null]))
        );
        assert_eq!(property(entries, "a").and_then(Json::as_str), Some("x"));
        assert_eq!(property(entries, "missing"), None);
        assert_eq!(
            property(entries, "c"),
            Some(&Json::Object(vec![("d".to_owned(), Json::Number(1.5))]))
        );
    }

    /// R9 review H2: one 1 MiB body of distinct keys took 10 s of a Tokio
    /// worker while each key was checked against every key before it.
    #[test]
    fn json_objects_with_many_keys_parse_in_linear_time() {
        let mut body = String::from(r#"{"plan":{"values":{"#);
        let mut count = 0;
        while body.len() < 1024 * 1024 - 64 {
            if count > 0 {
                body.push(',');
            }
            body.push_str(&format!("\"k{count:x}\":0"));
            count += 1;
        }
        body.push_str(r#","k0":1}}}"#);
        let started = std::time::Instant::now();
        let parsed = Json::parse(&body).unwrap();
        let elapsed = started.elapsed();

        let plan = property(parsed.as_object().unwrap(), "plan").unwrap();
        let values = property(plan.as_object().unwrap(), "values").unwrap();
        let entries = values.as_object().unwrap();
        assert_eq!(entries.len(), count);
        // The duplicate keeps the first key's place and the last value.
        assert_eq!(entries[0], ("k0".to_owned(), Json::Number(1.0)));
        assert!(elapsed < std::time::Duration::from_secs(1), "{elapsed:?}");
    }

    #[test]
    fn json_numbers_are_doubles_and_only_objects_are_objects() {
        assert_eq!(
            Json::parse("18446744073709551615"),
            Some(Json::Number(18_446_744_073_709_551_616.0))
        );
        assert_eq!(Json::parse(" \n7 "), Some(Json::Number(7.0)));
        for not_an_object in ["null", "[]", "[{}]", "\"{}\"", "1", "true"] {
            assert!(
                Json::parse(not_an_object).unwrap().as_object().is_none(),
                "{not_an_object}"
            );
        }
        for malformed in ["", "{", "{'a':1}", "{\"a\":1,}", "nul", "1 2", "\u{feff}1"] {
            assert_eq!(Json::parse(malformed), None, "{malformed:?}");
        }
    }

    // Expected values are what Node prints for decodeURIComponent(input), or
    // None where it throws.
    #[test]
    fn decode_uri_component_matches_javascript() {
        let decode = |text: &str| decode_uri_component(text);

        assert_eq!(decode("plain.text_-~").as_deref(), Some("plain.text_-~"));
        assert_eq!(decode("a%2Fb%2B%3D%25").as_deref(), Some("a/b+=%"));
        assert_eq!(decode("%EB%B0%88%f0%9f%98%80").as_deref(), Some("밈😀"));
        assert_eq!(decode("a+b").as_deref(), Some("a+b"));
        assert_eq!(decode("raw\u{e9}%41").as_deref(), Some("raw\u{e9}A"));
        for malformed in [
            "%",
            "a%2",
            "%zz",
            "%+1",
            "%FF",
            "%C3",
            "%C3A",
            "%C3%41",
            "%E0%80%80",
            "%ED%A0%80",
            "%F8%80%80%80%80",
            "%80",
        ] {
            assert_eq!(decode(malformed), None, "{malformed}");
        }
    }
}
