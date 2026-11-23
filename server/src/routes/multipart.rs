//! `new Request(...).formData()` as Node 22 parses it (undici 6.29), which
//! the upload routes rely on through `readBoundedFormData`
//! (lib/request-body.ts). The Next image runs `node:22-bookworm-slim`.
//!
//! This follows undici 6's `extractMimeType`, `parseMIMEType`,
//! `multipartFormDataParser` and `parseMultipartFormDataHeaders` step by step,
//! quirks included: the disposition must start with exactly
//! `form-data; name="`, a part ends four bytes before the next place the
//! boundary text occurs, and a header line ends when the next byte is CR *or*
//! the one after it is LF. Node 24 and 26 parse some bodies differently.
//! `tests/fixtures/multipart.json`, written by `parity/multipart-fixture.mjs`
//! from the real `formData()` of Node 22, holds this to that.

use std::ops::Range;
use std::time::Duration;

use axum::body::{Body, Bytes};
use axum::http::HeaderMap;
use axum::http::header::CONTENT_TYPE;
use base64::Engine;
use futures_util::{Stream, StreamExt};

use super::public::csp_report::declares_too_large;
use super::request::BodyError;

/// One entry of the form, in the order of the body.
#[derive(Debug, PartialEq)]
pub struct Entry {
    pub name: String,
    pub value: Value,
}

#[derive(Debug, PartialEq)]
pub enum Value {
    /// A part without a filename: its bytes as text.
    Text(String),
    /// A part with a filename: a `File`. `content_type` is `File.type`.
    File { content_type: String, bytes: Bytes },
}

/// The entries of a parsed form.
#[derive(Debug, Default, PartialEq)]
pub struct Form(pub Vec<Entry>);

impl Form {
    /// `form.get(name)`: the first entry of that name.
    pub fn get(&self, name: &str) -> Option<&Value> {
        self.0
            .iter()
            .find(|entry| entry.name == name)
            .map(|entry| &entry.value)
    }

    /// `form.has(name)`.
    pub fn has(&self, name: &str) -> bool {
        self.get(name).is_some()
    }
}

fn is_http_space(byte: u8) -> bool {
    matches!(byte, b'\t' | b'\n' | b'\r' | b' ')
}

fn is_blank(byte: u8) -> bool {
    matches!(byte, b' ' | b'\t')
}

/// `HTTP_TOKEN_CODEPOINTS`.
fn is_token(text: &[u8]) -> bool {
    !text.is_empty()
        && text
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || b"!#$%&'*+-.^_|~".contains(byte))
}

/// `HTTP_QUOTED_STRING_TOKENS`, header text being Latin-1.
fn is_quoted_string_text(text: &[u8]) -> bool {
    text.iter()
        .all(|byte| *byte == b'\t' || (0x20..=0x7e).contains(byte) || *byte >= 0x80)
}

/// undici's `removeChars`. Its trailing loop stops at index 1, so the first
/// byte is never removed from the end.
fn remove(bytes: &[u8], leading: bool, trailing: bool, strip: fn(u8) -> bool) -> &[u8] {
    let start = if leading {
        bytes
            .iter()
            .position(|byte| !strip(*byte))
            .unwrap_or(bytes.len())
    } else {
        0
    };
    let mut end = bytes.len();
    if trailing {
        while end > 1 && strip(bytes[end - 1]) {
            end -= 1;
        }
    }
    bytes.get(start..end).unwrap_or_default()
}

/// The text from `from` up to the first byte `stop` takes (or the end), and
/// the index of that byte.
fn until(input: &[u8], from: usize, stop: impl Fn(u8) -> bool) -> (&[u8], usize) {
    let rest = input.get(from..).unwrap_or_default();
    let length = rest
        .iter()
        .position(|byte| stop(*byte))
        .unwrap_or(rest.len());
    (&rest[..length], from + length)
}

/// `collectAnHTTPQuotedString` from the opening quote at `from`: the value
/// (`\x` unescaped), the raw text, and the index after it.
fn quoted(input: &[u8], from: usize) -> (Vec<u8>, Range<usize>, usize) {
    let mut value = Vec::new();
    let mut at = from + 1;
    loop {
        let (text, next) = until(input, at, |byte| matches!(byte, b'"' | b'\\'));
        value.extend_from_slice(text);
        at = next;
        let Some(&byte) = input.get(at) else { break };
        at += 1;
        if byte == b'"' {
            break;
        }
        let Some(&escaped) = input.get(at) else {
            value.push(b'\\');
            break;
        };
        value.push(escaped);
        at += 1;
    }
    (value, from..at, at)
}

/// A MIME type parameter: its name (lower case) and value.
type Parameter = (Vec<u8>, Vec<u8>);

/// One parameter of a MIME type from `at` (on its `;`): its name and value,
/// `None` for one without a value, and where the next one starts.
fn parameter(input: &[u8], at: usize) -> (Option<Parameter>, usize) {
    let at = until(input, at + 1, |byte| !is_http_space(byte)).1;
    let (name, mut at) = until(input, at, |byte| matches!(byte, b';' | b'='));
    let name = name.to_ascii_lowercase();
    if at < input.len() {
        if input[at] == b';' {
            return (None, at);
        }
        at += 1;
    }
    if input.get(at) == Some(&b'"') {
        let (value, _, next) = quoted(input, at);
        return (
            Some((name, value)),
            until(input, next, |byte| byte == b';').1,
        );
    }
    let (value, next) = until(input, at, |byte| byte == b';');
    let value = remove(value, false, true, is_http_space);
    let parsed = (!value.is_empty()).then(|| (name, value.to_vec()));
    (parsed, next)
}

/// `parseMIMEType`: the essence and the first valid `boundary` parameter.
fn parse_mime(input: &[u8]) -> Option<(Vec<u8>, Option<Vec<u8>>)> {
    let input = remove(input, true, true, is_http_space);
    let (kind, after) = until(input, 0, |byte| byte == b'/');
    if !is_token(kind) {
        return None;
    }
    let (subtype, mut at) = until(input, after + 1, |byte| byte == b';');
    let subtype = remove(subtype, false, true, is_http_space);
    if !is_token(subtype) {
        return None;
    }
    let essence = [kind, b"/", subtype].concat().to_ascii_lowercase();
    let mut boundary = None;
    while at < input.len() {
        let (parsed, next) = parameter(input, at);
        at = next;
        let Some((name, value)) = parsed else {
            continue;
        };
        let valid = is_token(&name) && (value.is_empty() || is_quoted_string_text(&value));
        if valid && name == b"boundary" && boundary.is_none() {
            boundary = Some(value);
        }
    }
    Some((essence, boundary))
}

/// `extractMimeType`: of the comma-separated values of `Content-Type`, the
/// last that parses and is not `*/*`.
fn extract_mime(header: &[u8]) -> Option<(Vec<u8>, Option<Vec<u8>>)> {
    let mut values = Vec::new();
    let mut value = Vec::new();
    let mut at = 0;
    while at < header.len() {
        let (text, next) = until(header, at, |byte| matches!(byte, b'"' | b','));
        value.extend_from_slice(text);
        at = next;
        if at < header.len() {
            if header[at] == b'"' {
                let (_, raw, next) = quoted(header, at);
                value.extend_from_slice(&header[raw]);
                at = next;
                if at < header.len() {
                    continue;
                }
            } else {
                at += 1;
            }
        }
        values.push(remove(&value, true, true, is_blank).to_vec());
        value.clear();
    }
    values
        .iter()
        .filter_map(|value| parse_mime(value))
        .rfind(|(essence, _)| essence != b"*/*")
}

/// `TextDecoder().decode`: lossy UTF-8 without one leading BOM.
fn decode(bytes: &[u8]) -> String {
    let text = String::from_utf8_lossy(bytes);
    text.strip_prefix('\u{feff}').unwrap_or(&text).to_owned()
}

/// `utf8DecodeBytes`: drops a leading BOM, then decodes as above (which
/// drops a second one).
fn decode_value(bytes: &[u8]) -> String {
    decode(bytes.strip_prefix(b"\xef\xbb\xbf").unwrap_or(bytes))
}

/// `parseMultipartFormDataName` after its opening quote: the name with
/// `%0A`, `%0D` and `%22` unescaped, and the index after its closing quote.
fn quoted_name(input: &[u8], from: usize) -> Option<(String, usize)> {
    let (raw, at) = until(input, from, |byte| matches!(byte, b'\n' | b'\r' | b'"'));
    if input.get(at) != Some(&b'"') {
        return None;
    }
    let name = decode(raw)
        .replace("%0A", "\n")
        .replace("%0a", "\n")
        .replace("%0D", "\r")
        .replace("%0d", "\r")
        .replace("%22", "\"");
    Some((name, at + 1))
}

/// The headers of one part.
#[derive(Default)]
struct PartHeaders {
    name: Option<String>,
    filename: Option<String>,
    content_type: Option<Vec<u8>>,
    encoding: Option<Vec<u8>>,
}

const FORM_DATA_NAME: &[u8] = br#"form-data; name=""#;
const FILENAME: &[u8] = b"; filename";

/// The `content-disposition` value at `at`: sets name and filename.
fn disposition(input: &[u8], at: usize, headers: &mut PartHeaders) -> Option<usize> {
    headers.name = None;
    headers.filename = None;
    if input.get(at..at + FORM_DATA_NAME.len()) != Some(FORM_DATA_NAME) {
        return None;
    }
    let (name, mut at) = quoted_name(input, at + FORM_DATA_NAME.len())?;
    headers.name = Some(name);
    if input.get(at..at + FILENAME.len()) == Some(FILENAME) {
        // `filename*="..."` is read as a plain quoted name.
        let mut check = at + FILENAME.len();
        if input.get(check) == Some(&b'*') {
            at += 1;
            check += 1;
        }
        if input.get(check..check + 2) != Some(b"=\"") {
            return None;
        }
        let (filename, next) = quoted_name(input, at + FILENAME.len() + 2)?;
        headers.filename = Some(filename);
        at = next;
    }
    Some(at)
}

/// The rest of a header line, without trailing blanks.
fn line(input: &[u8], at: usize) -> (Vec<u8>, usize) {
    let (value, next) = until(input, at, |byte| matches!(byte, b'\n' | b'\r'));
    (remove(value, false, true, is_blank).to_vec(), next)
}

/// `parseMultipartFormDataHeaders`: the headers and the index of the blank
/// line after them.
fn part_headers(input: &[u8], mut at: usize) -> Option<(PartHeaders, usize)> {
    let mut headers = PartHeaders::default();
    loop {
        if input.get(at..at + 2) == Some(b"\r\n") {
            return headers.name.is_some().then_some((headers, at));
        }
        let (name, next) = until(input, at, |byte| matches!(byte, b'\n' | b'\r' | b':'));
        let name = remove(name, true, true, is_blank);
        if !is_token(name) || input.get(next) != Some(&b':') {
            return None;
        }
        at = until(input, next + 1, |byte| !is_blank(byte)).1;
        match name.to_ascii_lowercase().as_slice() {
            b"content-disposition" => at = disposition(input, at, &mut headers)?,
            b"content-type" => {
                let (value, next) = line(input, at);
                (headers.content_type, at) = (Some(value), next);
            }
            b"content-transfer-encoding" => {
                let (value, next) = line(input, at);
                (headers.encoding, at) = (Some(value), next);
            }
            _ => at = line(input, at).1,
        }
        // `input[p] !== 0x0d && input[p + 1] !== 0x0a`: either one will do.
        if input.get(at) != Some(&b'\r') && input.get(at + 1) != Some(&b'\n') {
            return None;
        }
        at += 2;
    }
}

/// `Buffer.from(body.toString(), "base64")`: what is not in the alphabet is
/// skipped and the text ends at the first `=`.
fn node_base64(body: &[u8]) -> Vec<u8> {
    let symbols: Vec<u8> = String::from_utf8_lossy(body)
        .bytes()
        .take_while(|byte| *byte != b'=')
        .filter_map(|byte| match byte {
            b'-' => Some(b'+'),
            b'_' => Some(b'/'),
            byte if byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/') => Some(byte),
            _ => None,
        })
        .collect();
    // A lone trailing symbol carries no whole byte.
    let whole = symbols.len() - usize::from(symbols.len() % 4 == 1);
    base64::engine::general_purpose::STANDARD_NO_PAD
        .decode(&symbols[..whole])
        .unwrap_or_default()
}

/// `File.type`: `text/plain` when the part has none; empty when it holds a
/// byte outside printable ASCII; else in lower case.
fn file_type(content_type: Option<Vec<u8>>) -> String {
    let content_type = content_type.unwrap_or_else(|| b"text/plain".to_vec());
    if content_type.iter().all(|byte| (0x20..=0x7e).contains(byte)) {
        String::from_utf8_lossy(&content_type).to_ascii_lowercase()
    } else {
        String::new()
    }
}

/// `Buffer.indexOf(needle, from)`.
fn find(input: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if needle.is_empty() {
        return (from <= input.len()).then_some(from);
    }
    input
        .get(from..)?
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|at| at + from)
}

/// The body without the CRLF pairs undici allows before and after it.
fn trimmed_crlf(body: &[u8]) -> Range<usize> {
    let mut start = 0;
    while body.get(start..start + 2) == Some(b"\r\n") {
        start += 2;
    }
    let mut end = body.len();
    while end >= 2 && &body[end - 2..end] == b"\r\n" {
        end -= 2;
    }
    start..end.max(start)
}

/// One part from `at` (after the CRLF of its boundary line): the entry and
/// the index after the CRLF that ends its content.
fn part(input: &Bytes, boundary: &[u8], at: usize) -> Option<(Entry, usize)> {
    let (headers, after) = part_headers(input, at)?;
    let at = after + 2;
    let next = find(input, &boundary[2..], at)?;
    let content = at..next.saturating_sub(4).max(at);
    let end = content.end;
    if input.get(end..end + 2) != Some(b"\r\n") {
        return None;
    }
    let bytes = match headers.encoding.as_deref() {
        Some(b"base64") => Bytes::from(node_base64(&input[content])),
        _ => input.slice(content),
    };
    let value = match headers.filename {
        Some(_) => Value::File {
            content_type: file_type(headers.content_type),
            bytes,
        },
        None => Value::Text(decode_value(&bytes)),
    };
    let name = headers.name?;
    Some((Entry { name, value }, end + 2))
}

/// `multipartFormDataParser`. `boundary_text` is the parameter as header
/// text, one Latin-1 character per byte; undici encodes it as UTF-8.
fn multipart(body: &Bytes, boundary_text: &[u8]) -> Option<Form> {
    let text: String = boundary_text.iter().map(|&byte| char::from(byte)).collect();
    let boundary = format!("--{text}").into_bytes();
    let range = trimmed_crlf(body);
    let input = body.slice(..range.end);
    let mut at = range.start;
    let mut entries = Vec::new();
    loop {
        if input.get(at..at + boundary.len()) != Some(&boundary[..]) {
            return None;
        }
        at += boundary.len();
        let rest = &input[at..];
        if rest == b"--" || rest == b"--\r\n" {
            return Some(Form(entries));
        }
        if !rest.starts_with(b"\r\n") {
            return None;
        }
        let (entry, next) = part(&input, &boundary, at + 2)?;
        entries.push(entry);
        at = next;
    }
}

/// The body was declared or read past the limit (`RequestBodyTooLargeError`).
#[derive(Debug, PartialEq, Eq)]
pub struct TooLarge;

/// How long a body nobody reads is still taken in and thrown away: Node's
/// `server.requestTimeout`.
const DRAIN_FOR: Duration = Duration::from_secs(300);

/// What Node does with the part of a request body a handler did not read: it
/// reads it and throws it away, so a client still sending gets to read the
/// answer instead of a reset connection. Nothing is kept.
pub fn drain<S>(mut stream: S)
where
    S: Stream + Send + Unpin + 'static,
    S::Item: Send,
{
    tokio::spawn(async move {
        let all = async { while stream.next().await.is_some() {} };
        if tokio::time::timeout(DRAIN_FOR, all).await.is_err() {
            tracing::debug!("stopped draining a request body after 300 s");
        }
    });
}

/// [`drain`] for a body not yet read at all.
pub fn drain_body(body: Body) {
    drain(body.into_data_stream());
}

/// `readBoundedBytes`: the body, given up on (and drained) as soon as more
/// than `max_bytes` has arrived, so at most one chunk more is ever held.
async fn read_bounded(body: Body, max_bytes: usize) -> Result<Bytes, BodyError> {
    let mut stream = body.into_data_stream();
    let mut bytes = Vec::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| BodyError::Unreadable)?;
        if bytes.len() + chunk.len() > max_bytes {
            drain(stream);
            return Err(BodyError::TooLarge);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(Bytes::from(bytes))
}

/// `readBoundedFormData(request, max_bytes)` of lib/request-body.ts, as the
/// upload routes call it: `Err(TooLarge)` where it throws
/// `RequestBodyTooLargeError`, `Ok(None)` where it throws anything else
/// (a body that breaks off, or one `formData()` refuses).
pub async fn read_bounded_form(
    headers: &HeaderMap,
    body: Body,
    max_bytes: usize,
) -> Result<Option<Form>, TooLarge> {
    if declares_too_large(headers, max_bytes) {
        drain_body(body);
        return Err(TooLarge);
    }
    let bytes = match read_bounded(body, max_bytes).await {
        Ok(bytes) => bytes,
        Err(BodyError::TooLarge) => return Err(TooLarge),
        Err(BodyError::Unreadable) => return Ok(None),
    };
    let content_type: Vec<&[u8]> = headers
        .get_all(CONTENT_TYPE)
        .iter()
        .map(|value| value.as_bytes())
        .collect();
    let content_type = (!content_type.is_empty()).then(|| content_type.join(&b", "[..]));
    Ok(form_data(content_type.as_deref(), &bytes))
}

/// `new Request(url, { headers, body }).formData()`. `content_type` is the
/// `Content-Type` header as `Headers.get` gives it. `None` when it throws.
pub fn form_data(content_type: Option<&[u8]>, body: &Bytes) -> Option<Form> {
    let (essence, boundary) = extract_mime(content_type?)?;
    match essence.as_slice() {
        b"multipart/form-data" => multipart(body, &boundary?),
        b"application/x-www-form-urlencoded" => Some(Form(
            url::form_urlencoded::parse(String::from_utf8_lossy(body).as_bytes())
                .map(|(name, value)| Entry {
                    name: name.into_owned(),
                    value: Value::Text(value.into_owned()),
                })
                .collect(),
        )),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct Case {
        name: String,
        #[serde(rename = "contentType")]
        content_type: Option<String>,
        body: String,
        #[serde(default)]
        error: bool,
        #[serde(default)]
        entries: Vec<Expected>,
    }

    #[derive(Debug, Deserialize, PartialEq)]
    struct Expected {
        name: String,
        value: Option<String>,
        #[serde(rename = "type")]
        content_type: Option<String>,
        size: Option<usize>,
    }

    fn entries(form: Form) -> Vec<Expected> {
        form.0
            .into_iter()
            .map(|entry| match entry.value {
                Value::Text(value) => Expected {
                    name: entry.name,
                    value: Some(value),
                    content_type: None,
                    size: None,
                },
                Value::File {
                    content_type,
                    bytes,
                } => Expected {
                    name: entry.name,
                    value: None,
                    content_type: Some(content_type),
                    size: Some(bytes.len()),
                },
            })
            .collect()
    }

    #[test]
    fn every_case_parses_as_node_22_parsed_it() {
        let cases: Vec<Case> =
            serde_json::from_str(include_str!("../../tests/fixtures/multipart.json"))
                .expect("fixture");
        assert!(cases.len() >= 60);

        for case in cases {
            let body = Bytes::from(
                base64::engine::general_purpose::STANDARD
                    .decode(&case.body)
                    .expect("base64 body"),
            );
            // The header text is Latin-1: one byte per character.
            let header = case.content_type.map(|text| {
                text.chars()
                    .map(|c| u8::try_from(u32::from(c)).expect("a Latin-1 header"))
                    .collect::<Vec<u8>>()
            });
            let form = form_data(header.as_deref(), &body);

            assert_eq!(
                form.map(entries),
                (!case.error).then_some(case.entries),
                "{}",
                case.name
            );
        }
    }
}
