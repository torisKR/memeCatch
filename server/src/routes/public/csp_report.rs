//! `POST /api/csp-report` accepts legacy CSP and batched Reporting API reports.
//!
//! Always 204 with no body. The only other outputs are a `Retry-After` header
//! when the caller is rate limited and one log line per reported violation.
//!
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::body::to_bytes;
use axum::extract::{ConnectInfo, Request};
use axum::http::header::{CONTENT_LENGTH, CONTENT_TYPE, HeaderMap, RETRY_AFTER};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::Value;

use super::rate_limit::{self, RateLimit, RateLimiter};

const MAX_BODY_BYTES: usize = 16 * 1024;
const MAX_REPORTS: usize = 20;
const MAX_FIELD_CHARS: usize = 300;
const MAX_SUMMARY_KEYS: usize = 4;
const MAX_SUMMARY_KEY_BYTES: usize = 24;
const RATE_LIMIT: usize = 60;
const RATE_WINDOW_MS: i64 = 60_000;
const REPORT_CONTENT_TYPES: [&[u8]; 2] = [b"application/reports+json", b"application/csp-report"];

/// `Date.now()`.
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

pub async fn report(limiter: Arc<RateLimiter>, request: Request) -> Response {
    let (parts, body) = request.into_parts();
    let peer = parts
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let key = [
        b"csp-report:",
        rate_limit::client_ip(&parts.headers, peer).as_slice(),
    ]
    .concat();
    if let RateLimit::Limited { retry_after_sec } =
        limiter.check(key, RATE_LIMIT, RATE_WINDOW_MS, now_ms())
    {
        return (
            StatusCode::NO_CONTENT,
            [(RETRY_AFTER, HeaderValue::from(retry_after_sec))],
        )
            .into_response();
    }

    if is_report(&parts.headers) && !declares_too_large(&parts.headers, MAX_BODY_BYTES) {
        // More than the limit is an error here, as in readBoundedText.
        match to_bytes(body, MAX_BODY_BYTES).await {
            Ok(bytes) => {
                for line in violation_lines(&bytes) {
                    tracing::warn!("{line}");
                }
            }
            Err(error) => tracing::debug!(%error, "csp report body not read"),
        }
    }
    StatusCode::NO_CONTENT.into_response()
}

/// `content-type` up to the first `;`, trimmed, is one of the two report
/// types. The comparison is case-sensitive, as in the TypeScript.
fn is_report(headers: &HeaderMap) -> bool {
    headers.get(CONTENT_TYPE).is_some_and(|value| {
        let media_type = value.as_bytes().split(|byte| *byte == b';').next();
        REPORT_CONTENT_TYPES.contains(&rate_limit::trim(media_type.unwrap_or_default()))
    })
}

/// The `Content-Length` check of `readBoundedText`: a non-empty value that is
/// not all digits, or is larger than `max_bytes`.
pub(crate) fn declares_too_large(headers: &HeaderMap, max_bytes: usize) -> bool {
    headers.get(CONTENT_LENGTH).is_some_and(|value| {
        let declared = value.as_bytes();
        !declared.is_empty()
            && std::str::from_utf8(declared)
                .ok()
                .filter(|text| text.bytes().all(|byte| byte.is_ascii_digit()))
                .and_then(|text| text.parse::<usize>().ok())
                .is_none_or(|length| length > max_bytes)
    })
}

/// One `[CSP-VIOLATION] ...` line per report in a request body.
pub fn violation_lines(body: &[u8]) -> Vec<String> {
    if body.len() > MAX_BODY_BYTES {
        return Vec::new();
    }
    // TextDecoder: invalid bytes become U+FFFD and a leading BOM is dropped.
    let decoded = String::from_utf8_lossy(body);
    let raw = decoded.strip_prefix('\u{feff}').unwrap_or(&decoded);
    // The second size check: replacement characters can make the text longer
    // than the bytes it came from.
    if raw.is_empty() || raw.len() > MAX_BODY_BYTES {
        return Vec::new();
    }
    let Ok(parsed) = serde_json::from_str::<Value>(raw) else {
        return Vec::new();
    };
    // Reporting API v1 sends an array, the legacy format a single object.
    let items = match &parsed {
        Value::Array(items) => &items[..items.len().min(MAX_REPORTS)],
        single => std::slice::from_ref(single),
    };
    items.iter().map(violation_line).collect()
}

fn violation_line(item: &Value) -> String {
    let present = |key: &str| item.get(key).filter(|value| !value.is_null());
    let body = present("body").or_else(|| present("csp-report"));
    let fields = body.unwrap_or(item);
    let field = |key: &str| {
        fields
            .get(key)
            .and_then(Value::as_str)
            .filter(|value| !value.is_empty())
    };
    let directive = [
        "effectiveDirective",
        "effective-directive",
        "violated-directive",
    ]
    .into_iter()
    .filter_map(field)
    .filter_map(|value| value.split_ascii_whitespace().next())
    .find(|name| {
        name.bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
    });
    let Some(directive) = directive else {
        let mut summary = shape(item);
        if let Some(body) = body {
            summary.push_str(&format!(" payload={}", shape(body)));
        }
        return format!("[CSP-VIOLATION] unrecognized report {summary}");
    };

    let disposition = field("disposition")
        .filter(|value| *value == "report")
        .unwrap_or("enforce");
    let blocked = safe_url(field("blockedURL").or_else(|| field("blocked-uri")));
    let document = safe_url(
        field("documentURL")
            .or_else(|| field("document-uri"))
            .or_else(|| item.get("url").and_then(Value::as_str)),
    );
    let directive = safe_field(directive);
    format!(
        "[CSP-VIOLATION] disposition={disposition} directive=\"{directive}\" blocked=\"{blocked}\" doc=\"{document}\""
    )
}

/// Summarize the schema without including values such as referrers or samples.
fn shape(value: &Value) -> String {
    match value {
        Value::Object(fields) => {
            let keys = fields
                .keys()
                .filter(|key| {
                    !key.is_empty()
                        && key
                            .bytes()
                            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
                })
                .take(MAX_SUMMARY_KEYS)
                .map(|key| &key[..key.len().min(MAX_SUMMARY_KEY_BYTES)])
                .collect::<Vec<_>>();
            format!("object({})[{}]", fields.len(), keys.join(","))
        }
        Value::Array(items) => format!("array({})", items.len()),
        Value::String(_) => "string".to_owned(),
        Value::Number(_) => "number".to_owned(),
        Value::Bool(_) => "boolean".to_owned(),
        Value::Null => "null".to_owned(),
    }
}

fn safe_url(value: Option<&str>) -> String {
    let path = value
        .and_then(|text| text.split(['?', '#']).next())
        .filter(|path| !path.is_empty());
    safe_field(path.unwrap_or("-"))
}

/// Escape `\` and `"`, blank out control characters, keep the first 300 UTF-16 code units.
fn safe_field(text: &str) -> String {
    let mut units: Vec<u16> = Vec::with_capacity(MAX_FIELD_CHARS + 2);
    for c in text.chars() {
        match c {
            '\\' | '"' => units.extend([u16::from(b'\\'), c as u16]),
            '\u{0}'..='\u{1f}' | '\u{7f}'..='\u{9f}' | '\u{2028}' | '\u{2029}' => {
                units.push(u16::from(b' '));
            }
            _ => units.extend(c.encode_utf16(&mut [0; 2]).iter()),
        }
        if units.len() >= MAX_FIELD_CHARS {
            break;
        }
    }
    units.truncate(MAX_FIELD_CHARS);
    // A cut through a surrogate pair leaves a lone surrogate, which Node
    // writes to the log as U+FFFD too.
    String::from_utf16_lossy(&units)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn too_large(headers: &HeaderMap) -> bool {
        declares_too_large(headers, MAX_BODY_BYTES)
    }
    use axum::http::header::HeaderName;

    fn lines(body: &str) -> Vec<String> {
        violation_lines(body.as_bytes())
    }

    #[test]
    fn legacy_and_reporting_api_formats_give_one_line_per_report() {
        let legacy = r#"{"csp-report":{"document-uri":"https://example.com/login?next=private#session","blocked-uri":"https://cdn.example/x.js#fragment?token=secret","violated-directive":"script-src-elem","effective-directive":"script-src","disposition":"report"}}"#;
        let v1 = r#"[{"type":"csp-violation","url":"https://example.com/unused","body":{"documentURL":"https://example.com/memes#section","blockedURL":"https://cdn.example/player?token=secret","effectiveDirective":"frame-src","disposition":"enforce"}},{"type":"csp-violation","url":"https://example.com/?token=private#section","body":{"effectiveDirective":"style-src-elem","blockedURL":"inline"}}]"#;

        assert_eq!(
            lines(legacy),
            [
                r#"[CSP-VIOLATION] disposition=report directive="script-src" blocked="https://cdn.example/x.js" doc="https://example.com/login""#
            ]
        );
        assert_eq!(
            lines(v1),
            [
                r#"[CSP-VIOLATION] disposition=enforce directive="frame-src" blocked="https://cdn.example/player" doc="https://example.com/memes""#,
                r#"[CSP-VIOLATION] disposition=enforce directive="style-src-elem" blocked="inline" doc="https://example.com/""#,
            ]
        );
    }

    #[test]
    fn malformed_or_empty_bodies_give_no_line() {
        for body in ["", "not json", "[]"] {
            assert_eq!(lines(body), Vec::<String>::new(), "{body}");
        }
    }

    #[test]
    fn unknown_shapes_log_a_bounded_summary_without_report_values() {
        let body = r#"[{"type":"csp-violation","body":{"a012345678901234567890123456789":"https://example.com/?secret=1","b":1,"c":1,"d":1,"e":1,"https://example.com/?secret=key":1},"url":"https://example.com/#secret"},{"csp-report":"https://example.com/?secret=2"},null]"#;
        assert_eq!(
            lines(body),
            [
                "[CSP-VIOLATION] unrecognized report object(3)[body,type,url] payload=object(6)[a01234567890123456789012,b,c,d]",
                "[CSP-VIOLATION] unrecognized report object(1)[csp-report] payload=string",
                "[CSP-VIOLATION] unrecognized report null",
            ]
        );
    }

    #[test]
    fn null_body_falls_through_to_the_legacy_key_then_to_the_record() {
        let via_legacy =
            r#"{"body":null,"csp-report":{"blocked-uri":"a","effective-directive":"script-src"}}"#;
        let record_itself = r#"{"blocked-uri":"b","effective-directive":null,"violated-directive":"img-src 'self'"}"#;

        assert!(lines(via_legacy)[0].contains(r#"blocked="a""#));
        assert_eq!(
            lines(record_itself),
            [r#"[CSP-VIOLATION] disposition=enforce directive="img-src" blocked="b" doc="-""#]
        );
    }

    #[test]
    fn only_the_first_twenty_reports_are_logged() {
        let body = format!("[{}]", vec![r#"{"body":{}}"#; 25].join(","));

        assert_eq!(lines(&body).len(), 20);
    }

    #[test]
    fn fields_are_escaped_blanked_and_cut_at_300_utf16_units() {
        let escaped = lines(
            r#"{"blocked-uri":"a\"b\\c\nd\u0085e f","effective-directive":"img-src","disposition":7,"document-uri":""}"#,
        );
        let long = lines(&format!(
            r#"{{"effectiveDirective":"img-src","blockedURL":"{}😀"}}"#,
            "x".repeat(299)
        ));
        let cut_inside_escape = lines(&format!(
            r#"{{"effectiveDirective":"img-src","blockedURL":"{}\""}}"#,
            "x".repeat(299)
        ));

        assert_eq!(
            escaped,
            [
                r#"[CSP-VIOLATION] disposition=enforce directive="img-src" blocked="a\"b\\c d e f" doc="-""#
            ]
        );
        // 299 units, then half of a surrogate pair.
        assert!(long[0].contains(&format!("blocked=\"{}\u{fffd}\"", "x".repeat(299))));
        // 299 units, then only the backslash of `\"`.
        assert!(cut_inside_escape[0].contains(&format!("blocked=\"{}\\\" doc", "x".repeat(299))));
    }

    #[test]
    fn a_bom_is_dropped_and_invalid_utf8_is_replaced_before_the_size_check() {
        let with_bom = [b"\xef\xbb\xbf".as_slice(), br#"{"blocked-uri":"a"}"#].concat();
        let invalid = [
            br#"{"effective-directive":"img-src","blocked-uri":"a"#.as_slice(),
            b"\xff",
            br#"b"}"#,
        ]
        .concat();
        // 16 KiB of bytes that each decode to a three-byte U+FFFD.
        let grows = [br#"{"blocked-uri":""#.as_slice(), &[0xff; 8_000], br#""}"#].concat();

        assert_eq!(violation_lines(&with_bom).len(), 1);
        assert!(violation_lines(&invalid)[0].contains("blocked=\"a\u{fffd}b\""));
        assert!(grows.len() <= MAX_BODY_BYTES);
        assert_eq!(violation_lines(&grows), Vec::<String>::new());
    }

    fn headers(pairs: &[(&'static str, &'static str)]) -> HeaderMap {
        pairs
            .iter()
            .map(|(name, value)| {
                (
                    HeaderName::from_static(name),
                    HeaderValue::from_static(value),
                )
            })
            .collect()
    }

    #[test]
    fn content_type_must_be_one_of_the_two_report_types_exactly() {
        for accepted in [
            "application/csp-report",
            "application/reports+json",
            " application/csp-report ; charset=utf-8",
        ] {
            assert!(
                is_report(&headers(&[("content-type", accepted)])),
                "{accepted}"
            );
        }
        for refused in [
            "application/json",
            "Application/CSP-Report",
            "application/csp-reports",
            "",
        ] {
            assert!(
                !is_report(&headers(&[("content-type", refused)])),
                "{refused}"
            );
        }
        assert!(!is_report(&headers(&[])));
    }

    #[test]
    fn declared_length_over_the_limit_is_refused_before_reading() {
        assert!(!too_large(&headers(&[])));
        assert!(!too_large(&headers(&[("content-length", "16384")])));
        assert!(too_large(&headers(&[("content-length", "16385")])));
        assert!(too_large(&headers(&[(
            "content-length",
            "99999999999999999999999"
        )])));
        assert!(too_large(&headers(&[("content-length", "12a")])));
    }
}
