//! The files of Next's `public/` folder (`AXUM_PUBLIC_DIR`), answered the
//! way Next answers them (it hands them to the `send` package): validators
//! from the file's size and time, `Range`, `304`, and Next's `500` for any
//! method but `GET` and `HEAD`. Route id `public-files`.
//!
//! The set of files is read once at startup, as Next does, so a name is
//! matched exactly (case included) and nothing outside the folder can be
//! reached. `/sw.js` is left out: it is built by Next's worker plugin, and
//! without an upstream `standalone::worker` answers it instead.
//!
//! Not done: gzip. Next compresses a compressible file over 1 KB when the
//! request allows it; Caddy's `encode gzip` does the same in front of Axum.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use axum::body::Body;
use axum::http::header::{
    ACCEPT_RANGES, ALLOW, CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_LENGTH, CONTENT_RANGE,
    CONTENT_TYPE, ETAG, HeaderMap, HeaderName, HeaderValue, LAST_MODIFIED, VARY,
};
use axum::http::{Method, StatusCode, Uri};
use axum::response::Response;
use percent_encoding::percent_decode_str;

use crate::AppState;
use crate::next_rules;
use crate::pages::retired::content_language;
use crate::routes::public::js_date;

pub const ROUTE_ID: &str = "public-files";

// The body and ETag Next sends with its own 500.
const ERROR_BODY: &str = "Internal Server Error";
const ERROR_ETAG: &str = "\"66fci67lppl\"";
const NO_STORE: &str = "private, no-cache, no-store, max-age=0, must-revalidate";
const DEFAULT_CACHE: &str = "public, max-age=0";

/// URL path (`/icons/icon-192.png`) to file.
pub struct PublicFiles(HashMap<String, PathBuf>);

impl PublicFiles {
    pub fn scan(root: &Path) -> Result<Self, String> {
        let mut files = HashMap::new();
        add_folder(root, "", &mut files)
            .map_err(|error| format!("AXUM_PUBLIC_DIR {}: {error}", root.display()))?;
        files.remove("/sw.js");
        Ok(Self(files))
    }

    pub fn len(&self) -> usize {
        self.0.len()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }

    pub fn contains(&self, raw_path: &str) -> bool {
        self.get(raw_path).is_some()
    }

    /// A file as `/_next/image` reads it: its bytes, the ETag and the
    /// `Cache-Control` Next would serve it with. `path` is decoded.
    pub async fn load(&self, path: &str) -> Option<PublicFile> {
        let file = self.0.get(path)?;
        let (bytes, modified_ms) = read(file).await.ok()?;
        Some(PublicFile {
            etag: format!("W/\"{:x}-{modified_ms:x}\"", bytes.len()),
            cache_control: next_rules::config_cache_control(path).unwrap_or(DEFAULT_CACHE),
            bytes,
        })
    }

    fn get(&self, raw_path: &str) -> Option<(String, &Path)> {
        let path = percent_decode_str(raw_path).decode_utf8().ok()?;
        let file = self.0.get(path.as_ref())?;
        Some((path.into_owned(), file))
    }
}

pub struct PublicFile {
    pub bytes: Vec<u8>,
    pub etag: String,
    pub cache_control: &'static str,
}

fn add_folder(
    folder: &Path,
    prefix: &str,
    files: &mut HashMap<String, PathBuf>,
) -> std::io::Result<()> {
    for entry in std::fs::read_dir(folder)? {
        let entry = entry?;
        let Ok(name) = entry.file_name().into_string() else {
            continue;
        };
        if name.starts_with('.') {
            continue;
        }
        let url = format!("{prefix}/{name}");
        let kind = entry.file_type()?;
        if kind.is_dir() {
            add_folder(&entry.path(), &url, files)?;
        } else if kind.is_file() {
            files.insert(url, entry.path());
        }
    }
    Ok(())
}

/// Next's answer for a request whose path names a public file, or `None`.
/// The caller leaves the `www` host alone: `proxy.ts` redirects it first.
pub async fn serve(
    state: &AppState,
    method: &Method,
    uri: &Uri,
    request: &HeaderMap,
) -> Option<Response> {
    let files = state.public_files.as_ref()?;
    let (path, file) = files.get(uri.path())?;
    let mut headers = HeaderMap::new();
    state.native_headers.apply_config(&mut headers);
    if next_rules::proxy_matches(&path) {
        let language = content_language(&path, uri.query());
        headers.insert(CONTENT_LANGUAGE, HeaderValue::from_static(language));
    }
    if method != Method::GET && method != Method::HEAD {
        return Some(method_refused(headers));
    }
    let (bytes, modified_ms) = match read(file).await {
        Ok(read) => read,
        Err(error) => {
            tracing::error!(path, %error, "public file could not be read");
            return None;
        }
    };
    Some(answer(&path, request, headers, bytes, modified_ms))
}

async fn read(file: &Path) -> std::io::Result<(Vec<u8>, i64)> {
    let bytes = tokio::fs::read(file).await?;
    let modified = tokio::fs::metadata(file).await?.modified()?;
    // Node's `stats.mtime` is `new Date(Math.round(mtimeMs))`.
    let ms = modified.duration_since(UNIX_EPOCH).map_or(0, |since| {
        i64::try_from((since.as_nanos() + 500_000) / 1_000_000).unwrap_or(i64::MAX)
    });
    Ok((bytes, ms))
}

/// A file is read with `GET` or `HEAD` only.
fn method_refused(mut headers: HeaderMap) -> Response {
    headers.insert(ALLOW, HeaderValue::from_static("GET,HEAD"));
    respond(StatusCode::METHOD_NOT_ALLOWED, headers, Vec::new())
}

/// Next's 500 after `send` failed, keeping the headers `send` had set.
fn error_response(mut headers: HeaderMap, vary: bool) -> Response {
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(NO_STORE));
    headers.insert(ETAG, HeaderValue::from_static(ERROR_ETAG));
    headers.insert(CONTENT_LENGTH, HeaderValue::from(ERROR_BODY.len()));
    if vary {
        headers.insert(VARY, HeaderValue::from_static("Accept-Encoding"));
    }
    respond(
        StatusCode::INTERNAL_SERVER_ERROR,
        headers,
        ERROR_BODY.as_bytes().to_vec(),
    )
}

fn respond(status: StatusCode, headers: HeaderMap, body: Vec<u8>) -> Response {
    let mut response = Response::new(Body::from(body));
    *response.status_mut() = status;
    *response.headers_mut() = headers;
    response
}

fn answer(
    path: &str,
    request: &HeaderMap,
    mut headers: HeaderMap,
    bytes: Vec<u8>,
    modified_ms: i64,
) -> Response {
    let size = bytes.len() as u64;
    let etag = format!("W/\"{size:x}-{modified_ms:x}\"");
    let last_modified = js_date::to_utc_string(modified_ms).unwrap_or_default();
    let (content_type, compressible) = content_type(path);
    headers.insert(ACCEPT_RANGES, HeaderValue::from_static("bytes"));
    let cache = next_rules::config_cache_control(path).unwrap_or(DEFAULT_CACHE);
    headers.insert(CACHE_CONTROL, HeaderValue::from_static(cache));
    insert_text(&mut headers, LAST_MODIFIED, &last_modified);
    insert_text(&mut headers, ETAG, &etag);
    headers.insert(CONTENT_TYPE, HeaderValue::from_static(content_type));

    let modified_s = modified_ms.div_euclid(1000);
    if precondition_failed(request, &etag, modified_s) {
        return error_response(headers, compressible);
    }
    if is_fresh(request, &etag, modified_s) {
        for name in [
            CONTENT_TYPE,
            CONTENT_LENGTH,
            CONTENT_LANGUAGE,
            CONTENT_RANGE,
        ] {
            headers.remove(name);
        }
        // A body of no known size: given an empty one, hyper writes
        // `Content-Length: 0` on the answer to a `HEAD`, which `send` does not.
        let mut response = Response::new(Body::from_stream(Body::empty().into_data_stream()));
        *response.status_mut() = StatusCode::NOT_MODIFIED;
        *response.headers_mut() = headers;
        return response;
    }
    if compressible {
        headers.insert(VARY, HeaderValue::from_static("Accept-Encoding"));
    }
    let range = header(request, "range")
        .filter(|_| range_applies(request, &etag, modified_s))
        .map(|range| parse_range(range, size));
    match range {
        Some(Range::Unsatisfiable) => {
            insert_text(&mut headers, CONTENT_RANGE, &format!("bytes */{size}"));
            error_response(headers, compressible)
        }
        Some(Range::One(start, end)) => {
            let content_range = format!("bytes {start}-{end}/{size}");
            insert_text(&mut headers, CONTENT_RANGE, &content_range);
            let part = bytes[start as usize..=end as usize].to_vec();
            headers.insert(CONTENT_LENGTH, HeaderValue::from(part.len()));
            respond(StatusCode::PARTIAL_CONTENT, headers, part)
        }
        Some(Range::Whole) | None => {
            headers.insert(CONTENT_LENGTH, HeaderValue::from(size));
            respond(StatusCode::OK, headers, bytes)
        }
    }
}

fn insert_text(headers: &mut HeaderMap, name: HeaderName, value: &str) {
    if let Ok(value) = HeaderValue::from_str(value) {
        headers.insert(name, value);
    }
}

fn header<'a>(headers: &'a HeaderMap, name: &str) -> Option<&'a str> {
    headers.get(name).and_then(|value| value.to_str().ok())
}

/// `mime` 1 as `send` uses it: the type by extension, `; charset=UTF-8` on
/// text, JavaScript and JSON; and whether `compression` would compress it
/// (it then adds `Vary: Accept-Encoding`).
fn content_type(path: &str) -> (&'static str, bool) {
    let extension = path
        .rsplit_once('.')
        .map(|(_, extension)| extension.to_ascii_lowercase())
        .unwrap_or_default();
    match extension.as_str() {
        "txt" => ("text/plain; charset=UTF-8", true),
        "html" | "htm" => ("text/html; charset=UTF-8", true),
        "css" => ("text/css; charset=UTF-8", true),
        "js" => ("application/javascript; charset=UTF-8", true),
        "json" => ("application/json; charset=UTF-8", true),
        "xml" => ("application/xml", true),
        "svg" => ("image/svg+xml", true),
        "ico" => ("image/x-icon", true),
        "png" => ("image/png", false),
        "jpg" | "jpeg" => ("image/jpeg", false),
        "gif" => ("image/gif", false),
        "webp" => ("image/webp", false),
        "avif" => ("image/avif", false),
        "woff2" => ("font/woff2", false),
        _ => ("application/octet-stream", false),
    }
}

/// An HTTP date (`Tue, 24 Nov 2026 03:36:44 GMT`) in seconds.
fn http_date_s(text: &str) -> Option<i64> {
    let format = time::format_description::parse_borrowed::<2>(
        "[weekday repr:short], [day] [month repr:short] [year] [hour]:[minute]:[second] GMT",
    )
    .ok()?;
    let at = time::PrimitiveDateTime::parse(text.trim(), &format).ok()?;
    Some(at.assume_utc().unix_timestamp())
}

fn tag_matches(list: &str, etag: &str) -> bool {
    list.split(',')
        .map(str::trim)
        .any(|tag| tag == etag || format!("W/{tag}") == etag || tag == format!("W/{etag}"))
}

/// `send`'s `isPreconditionFailure`: `If-Match` or `If-Unmodified-Since`.
fn precondition_failed(request: &HeaderMap, etag: &str, modified_s: i64) -> bool {
    if let Some(wanted) = header(request, "if-match") {
        return wanted != "*" && !tag_matches(wanted, etag);
    }
    header(request, "if-unmodified-since")
        .and_then(http_date_s)
        .is_some_and(|since| modified_s > since)
}

/// The `fresh` package: may the client keep its copy?
fn is_fresh(request: &HeaderMap, etag: &str, modified_s: i64) -> bool {
    let none_match = header(request, "if-none-match");
    let modified_since = header(request, "if-modified-since");
    if none_match.is_none() && modified_since.is_none() {
        return false;
    }
    let no_cache = header(request, "cache-control").is_some_and(|value| {
        value
            .split(',')
            .any(|directive| directive.trim().eq_ignore_ascii_case("no-cache"))
    });
    if no_cache {
        return false;
    }
    if let Some(list) = none_match.filter(|list| *list != "*")
        && !tag_matches(list, etag)
    {
        return false;
    }
    match modified_since {
        Some(since) => http_date_s(since).is_some_and(|since| modified_s <= since),
        None => true,
    }
}

/// `If-Range`: a tag must equal the ETag, a date must not be older than the file.
fn range_applies(request: &HeaderMap, etag: &str, modified_s: i64) -> bool {
    match header(request, "if-range") {
        None => true,
        Some(value) if value.contains('"') => value.contains(etag),
        Some(value) => http_date_s(value).is_some_and(|since| modified_s <= since),
    }
}

#[derive(Debug, PartialEq)]
enum Range {
    One(u64, u64),
    /// Several ranges or another unit: `send` answers the whole file.
    Whole,
    Unsatisfiable,
}

/// The `range-parser` package (no `combine`) for `bytes=` ranges.
fn parse_range(value: &str, size: u64) -> Range {
    let Some(list) = value.strip_prefix("bytes=") else {
        return Range::Whole;
    };
    let last = size.saturating_sub(1);
    let mut valid = Vec::new();
    for part in list.split(',') {
        let Some((start, end)) = part.split_once('-') else {
            continue;
        };
        let (start, end) = (start.trim(), end.trim());
        let parsed = match (start.parse::<u64>().ok(), end.parse::<u64>().ok()) {
            (None, Some(suffix)) if start.is_empty() => (size.saturating_sub(suffix), last),
            (Some(start), None) if end.is_empty() => (start, last),
            (Some(start), Some(end)) => (start, end.min(last)),
            _ => continue,
        };
        if parsed.0 <= parsed.1 && parsed.0 < size {
            valid.push(parsed);
        }
    }
    match valid.as_slice() {
        [] => Range::Unsatisfiable,
        [(start, end)] => Range::One(*start, *end),
        _ => Range::Whole,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranges_follow_range_parser() {
        assert_eq!(parse_range("bytes=0-9", 59), Range::One(0, 9));
        assert_eq!(parse_range("bytes=50-", 59), Range::One(50, 58));
        assert_eq!(parse_range("bytes=-5", 59), Range::One(54, 58));
        assert_eq!(parse_range("bytes=0-100", 59), Range::One(0, 58));
        assert_eq!(parse_range("bytes=70-80", 59), Range::Unsatisfiable);
        assert_eq!(parse_range("bytes=0-1,3-4", 59), Range::Whole);
        assert_eq!(parse_range("items=0-1", 59), Range::Whole);
    }

    #[test]
    fn freshness_follows_the_fresh_package() {
        let etag = "W/\"3b-1a20ba09978\"";
        let with = |pairs: &[(&'static str, &'static str)]| {
            let mut headers = HeaderMap::new();
            for (name, value) in pairs {
                headers.insert(*name, HeaderValue::from_static(value));
            }
            headers
        };
        let modified = http_date_s("Tue, 24 Nov 2026 03:36:44 GMT").unwrap();
        let fresh = |pairs: &[(&'static str, &'static str)]| is_fresh(&with(pairs), etag, modified);
        assert!(!fresh(&[]));
        assert!(fresh(&[("if-none-match", "W/\"3b-1a20ba09978\"")]));
        assert!(fresh(&[("if-none-match", "\"3b-1a20ba09978\"")]));
        assert!(!fresh(&[("if-none-match", "\"other\"")]));
        assert!(fresh(&[(
            "if-modified-since",
            "Tue, 24 Nov 2026 03:36:44 GMT"
        )]));
        assert!(!fresh(&[(
            "if-modified-since",
            "Tue, 24 Nov 2026 03:36:43 GMT"
        )]));
        assert!(!fresh(&[
            ("if-none-match", "*"),
            ("cache-control", "no-cache")
        ]));
    }

    #[test]
    fn types_are_those_send_gives() {
        assert_eq!(
            content_type("/ads.txt"),
            ("text/plain; charset=UTF-8", true)
        );
        assert_eq!(content_type("/brand/a.avif"), ("image/avif", false));
        assert_eq!(content_type("/a.svg"), ("image/svg+xml", true));
        assert_eq!(content_type("/a"), ("application/octet-stream", false));
    }
}
