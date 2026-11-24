//! `POST /api/analytics/events`: `app/api/analytics/events/route.ts`. Records
//! one client event through `record_bounded_client_growth_event`, which
//! applies the durable per-session and per-network limits and drops a repeat
//! of the same event within a minute (its dedupe key).
//!
//! The values written are built with JavaScript's string rules: lengths and
//! cuts count UTF-16 code units, and a cut through a surrogate pair leaves
//! half of it. As text that half reaches Postgres as U+FFFD; inside the
//! metadata JSON it is an escape Postgres refuses, and the route answers 500.

use std::fmt::Write;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{HeaderMap, RETRY_AFTER, SET_COOKIE};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use time::OffsetDateTime;

use super::growth::{self, is_uuid};
use super::{ACCEPTED, Client, RATE_LIMITED, Tracking, now_ms, refused};
use crate::AppState;
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::js;
use crate::routes::request::{self, BodyError, Json, RequestOrigin, property};

const MAX_BODY_BYTES: usize = 16 * 1024;
const EVENTS_PER_MINUTE_PER_IP: usize = 120;
const EVENTS_PER_MINUTE_PER_SESSION: usize = 60;
const CLIENT_EVENTS: [&str; 10] = [
    "meme_view",
    "follow_click",
    "copy",
    "paywall_view",
    "share_click",
    "quiz_start",
    "quiz_complete",
    "traffic_source",
    "plus_weekly_brief_opened",
    "plus_weekly_brief_clicked",
];
const METADATA_KEYS: [&str; 20] = [
    "result",
    "state",
    "channel",
    "brief_id",
    "meme_id",
    "item_count",
    "position",
    "source",
    "method",
    "to",
    "mode",
    "score",
    "medium",
    "resolved_by",
    "in_app_browser",
    "first_source",
    "first_medium",
    "first_resolved_by",
    "landing_page",
    "is_returning",
];
const MAX_METADATA_ENTRIES: usize = 12;
const MAX_DEDUPE_KEY_UNITS: usize = 220;
/// The error code `record_bounded_client_growth_event` raises at its limit.
const DURABLE_LIMIT_CODE: &str = "P0429";
const RECORD_EVENT: &str = "select public.record_bounded_client_growth_event(\
     p_event_name => $1, p_session_id => $2::uuid, p_network_hash => $3, \
     p_user_id => $4::uuid, p_meme_id => $5::uuid, p_surface => $6, p_format => $7, \
     p_locale => $8, p_path => $9, p_dedupe_key => $10, p_metadata => $11::jsonb, \
     p_occurred_at => $12::timestamptz)";

pub async fn record(
    State(state): State<AppState>,
    tracking: Arc<Tracking>,
    request: Request,
) -> Response {
    match request::request_origin(request.headers(), &tracking.site) {
        RequestOrigin::Site => {}
        RequestOrigin::Other | RequestOrigin::Absent => {
            return refused(StatusCode::FORBIDDEN, "origin_not_allowed");
        }
    }
    let (mut parts, body) = request.into_parts();
    let client = Client::of(&parts);
    if let Some(limited) =
        tracking.limited("analytics:ip:", &client.limit_key, EVENTS_PER_MINUTE_PER_IP)
    {
        return limited;
    }
    let session = tracking
        .keys
        .resolve_session(&parts.headers, growth::is_https(&parts.headers));
    if let Some(limited) = tracking.limited(
        "analytics:session:",
        session.session_id.as_bytes(),
        EVENTS_PER_MINUTE_PER_SESSION,
    ) {
        return limited;
    }

    let (event_name, fields) = match read_event(&parts.headers, body, &session.session_id).await {
        Ok(event) => event,
        Err((status, error)) => return refused(status, error),
    };

    // `db.auth.getUser()` never reports an error, so `auth_unavailable` is
    // not reachable: a session that cannot be read is no user.
    let user_id = request::session_user(&state, &mut parts)
        .await
        .map(|user| user.id);
    let event = GrowthEvent {
        event_name,
        session_id: session.session_id,
        network_hash: tracking.keys.network_hash(&client.address),
        user_id,
        fields,
        occurred_at: iso_timestamp(OffsetDateTime::now_utc()),
    };
    answer(record_event(&state.db, event).await, session.set_cookie)
}

/// The checks on the body, in the order of the TypeScript: its size, that it
/// is JSON, an object, a client event, and a meme id that is a UUID. `Err` is
/// the status and the `error` code to refuse with.
async fn read_event(
    headers: &HeaderMap,
    body: Body,
    session_id: &str,
) -> Result<(String, EventFields), (StatusCode, &'static str)> {
    let text = match request::read_bounded_text(headers, body, MAX_BODY_BYTES).await {
        Ok(text) => text,
        Err(BodyError::TooLarge) => {
            return Err((StatusCode::PAYLOAD_TOO_LARGE, "payload_too_large"));
        }
        Err(BodyError::Unreadable) => return Err((StatusCode::BAD_REQUEST, "invalid_json")),
    };
    let payload = Json::parse(&text).ok_or((StatusCode::BAD_REQUEST, "invalid_json"))?;
    let body = payload
        .as_object()
        .ok_or((StatusCode::BAD_REQUEST, "invalid_payload"))?;
    let event_name = property(body, "eventName")
        .and_then(Json::as_str)
        .filter(|name| CLIENT_EVENTS.contains(name))
        .ok_or((StatusCode::BAD_REQUEST, "invalid_event"))?;
    let minute = now_ms().div_euclid(60_000);
    let fields = EventFields::read(body, session_id, event_name, minute)
        .ok_or((StatusCode::BAD_REQUEST, "invalid_meme"))?;
    Ok((event_name.to_owned(), fields))
}

/// The answer to what the database function did. `set_cookie` starts the
/// session of a request that had none.
fn answer(recorded: Result<(), sqlx::Error>, set_cookie: Option<String>) -> Response {
    match recorded {
        Ok(()) => {
            let mut response = request::json(StatusCode::ACCEPTED, ACCEPTED);
            let set_cookie = set_cookie.and_then(|cookie| HeaderValue::from_str(&cookie).ok());
            if let Some(cookie) = set_cookie {
                response.headers_mut().insert(SET_COOKIE, cookie);
            }
            response
        }
        Err(error) if is_durable_limit(&error) => {
            let mut response = request::json(StatusCode::TOO_MANY_REQUESTS, RATE_LIMITED);
            response
                .headers_mut()
                .insert(RETRY_AFTER, HeaderValue::from_static("60"));
            response
        }
        // The TypeScript rethrows: 500 with no body.
        Err(error) => {
            tracing::error!(%error, "recording a growth event failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

fn is_durable_limit(error: &sqlx::Error) -> bool {
    error
        .as_database_error()
        .and_then(|database| database.code())
        .is_some_and(|code| code == DURABLE_LIMIT_CODE)
}

/// What the route derives from the body. Text goes to Postgres as a
/// parameter; `metadata` is the JSON text `JSON.stringify` would produce.
#[derive(Debug, PartialEq, Eq)]
struct EventFields {
    meme_id: Option<String>,
    surface: Option<String>,
    format: Option<String>,
    locale: Option<String>,
    path: Option<String>,
    dedupe_key: String,
    metadata: String,
}

impl EventFields {
    /// `None` is `invalid_meme`: a `meme_id` that is not a UUID.
    fn read(
        body: &[(String, Json)],
        session_id: &str,
        event_name: &str,
        minute: i64,
    ) -> Option<Self> {
        // `body.params` when it is an object, else `{}`.
        let params = property(body, "params")
            .and_then(Json::as_object)
            .unwrap_or_default();
        let param = |name: &str, max: usize| bounded(property(params, name), max);

        let meme_id = param("meme_id", 36).map(|units| String::from_utf16_lossy(&units));
        if meme_id.as_ref().is_some_and(|meme_id| !is_uuid(meme_id)) {
            return None;
        }
        let surface = param("surface", 80);
        let format = param("format", 80);
        let locale = param("locale", 12);
        let path = bounded(property(body, "path"), 300);
        let identity = meme_id
            .as_ref()
            .map(|meme_id| meme_id.encode_utf16().collect())
            .or_else(|| brief_identity(params))
            .or_else(|| format.clone())
            .or_else(|| surface.clone())
            .or_else(|| path.clone())
            .unwrap_or_else(|| "event".encode_utf16().collect());
        let mut dedupe_key: Vec<u16> = format!("client:{session_id}:{event_name}:")
            .encode_utf16()
            .collect();
        dedupe_key.extend(identity);
        dedupe_key.extend(format!(":{minute}").encode_utf16());
        dedupe_key.truncate(MAX_DEDUPE_KEY_UNITS);

        let text = |units: Option<Vec<u16>>| units.map(|units| String::from_utf16_lossy(&units));
        Some(Self {
            meme_id,
            surface: text(surface),
            format: text(format),
            locale: text(locale),
            path: text(path),
            dedupe_key: String::from_utf16_lossy(&dedupe_key),
            metadata: metadata_json(params),
        })
    }
}

/// `${briefId}:${position ?? "open"}` when the event names a weekly brief:
/// the position only when it is a whole number.
fn brief_identity(params: &[(String, Json)]) -> Option<Vec<u16>> {
    let mut brief = bounded(property(params, "brief_id"), 32)?;
    let position = match property(params, "position") {
        Some(Json::Number(position)) if position.fract() == 0.0 => js_number_text(*position),
        _ => "open".to_owned(),
    };
    brief.extend(format!(":{position}").encode_utf16());
    Some(brief)
}

/// `bounded(value, max)`: a string that is not blank, trimmed and cut to
/// `max` UTF-16 code units. The units, because the cut can split a pair.
fn bounded(value: Option<&Json>, max: usize) -> Option<Vec<u16>> {
    let trimmed = js::trim(value?.as_str()?);
    (!trimmed.is_empty()).then(|| trimmed.encode_utf16().take(max).collect())
}

/// `JSON.stringify` of the metadata object: the allowed keys of `params` in
/// the order they appear, strings bounded to 100 units, numbers as they are,
/// everything else left out, and no more than twelve entries.
fn metadata_json(params: &[(String, Json)]) -> String {
    let entries: Vec<String> = params
        .iter()
        .filter(|(key, _)| METADATA_KEYS.contains(&key.as_str()))
        .filter_map(|(key, value)| {
            let value = match value {
                Json::String(_) => json_string(&bounded(Some(value), 100)?),
                Json::Number(number) => js_number_text(*number),
                _ => return None,
            };
            Some(format!("\"{key}\":{value}"))
        })
        .take(MAX_METADATA_ENTRIES)
        .collect();
    format!("{{{}}}", entries.join(","))
}

/// A string as `JSON.stringify` quotes it. Half of a surrogate pair becomes
/// a `\ud83d`-style escape.
fn json_string(units: &[u16]) -> String {
    let mut quoted = String::with_capacity(units.len() + 2);
    quoted.push('"');
    for unit in char::decode_utf16(units.iter().copied()) {
        match unit {
            Ok('"') => quoted.push_str("\\\""),
            Ok('\\') => quoted.push_str("\\\\"),
            Ok('\u{8}') => quoted.push_str("\\b"),
            Ok('\u{c}') => quoted.push_str("\\f"),
            Ok('\n') => quoted.push_str("\\n"),
            Ok('\r') => quoted.push_str("\\r"),
            Ok('\t') => quoted.push_str("\\t"),
            Ok(control) if control < ' ' => {
                let _ = write!(quoted, "\\u{:04x}", u32::from(control));
            }
            Ok(character) => quoted.push(character),
            Err(lone) => {
                let _ = write!(quoted, "\\u{:04x}", lone.unpaired_surrogate());
            }
        }
    }
    quoted.push('"');
    quoted
}

/// `String(number)` for a finite number (ECMA-262, Number::toString): the
/// shortest digits that read back as the same double, written plainly
/// between 1e-7 and 1e21 and with an exponent outside that range.
fn js_number_text(number: f64) -> String {
    if number == 0.0 {
        return "0".to_owned();
    }
    // Rust's `{:e}` gives those shortest digits as `d.ddde<exponent>`.
    let scientific = format!("{:e}", number.abs());
    let (mantissa, exponent) = scientific.split_once('e').unwrap_or((&scientific, "0"));
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    let count = digits.len() as i32;
    // The decimal point sits after `point` digits.
    let point = exponent.parse::<i32>().unwrap_or(0) + 1;
    let zeros = |count: i32| "0".repeat(count.max(0) as usize);
    let text = if (count..=21).contains(&point) {
        format!("{digits}{}", zeros(point - count))
    } else if (1..=21).contains(&point) {
        let (whole, fraction) = digits.split_at(point as usize);
        format!("{whole}.{fraction}")
    } else if (-5..=0).contains(&point) {
        format!("0.{}{digits}", zeros(-point))
    } else {
        let sign = if point > 0 { '+' } else { '-' };
        let (first, rest) = digits.split_at(1);
        let fraction = if rest.is_empty() {
            String::new()
        } else {
            format!(".{rest}")
        };
        format!("{first}{fraction}e{sign}{}", (point - 1).abs())
    };
    if number < 0.0 {
        format!("-{text}")
    } else {
        text
    }
}

/// `new Date().toISOString()`: UTC with milliseconds.
pub(crate) fn iso_timestamp(now: OffsetDateTime) -> String {
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        now.year(),
        u8::from(now.month()),
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
        now.millisecond()
    )
}

struct GrowthEvent {
    event_name: String,
    session_id: String,
    network_hash: String,
    user_id: Option<String>,
    fields: EventFields,
    occurred_at: String,
}

/// `recordClientGrowthEvent`: the function runs as `service_role`, with the
/// arguments cast as the TypeScript query planner casts them.
async fn record_event(db: &Db, event: GrowthEvent) -> Result<(), sqlx::Error> {
    db.with_identity(
        &DbIdentity::service_role(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                let fields = event.fields;
                sqlx::query(RECORD_EVENT)
                    .bind(event.event_name)
                    .bind(event.session_id)
                    .bind(event.network_hash)
                    .bind(event.user_id)
                    .bind(fields.meme_id)
                    .bind(fields.surface)
                    .bind(fields.format)
                    .bind(fields.locale)
                    .bind(fields.path)
                    .bind(fields.dedupe_key)
                    .bind(fields.metadata)
                    .bind(event.occurred_at)
                    .execute(tx)
                    .await
                    .map(|_| ())
            })
        },
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    const SESSION: &str = "d5e11666-1ae9-4084-96f6-4c37f5e577b5";
    const MEME: &str = "11111111-1111-4111-8111-111111111111";

    fn fields(body: &str) -> Option<EventFields> {
        let payload = Json::parse(body).expect("valid JSON");
        EventFields::read(
            payload.as_object().expect("an object"),
            SESSION,
            "copy",
            29_924_000,
        )
    }

    fn dedupe_key(body: &str) -> String {
        fields(body).expect("fields").dedupe_key
    }

    // Expected values are what the route computes under Node for the same
    // body, session, event name and minute.
    #[test]
    fn fields_are_trimmed_and_cut_in_utf16_units() {
        let read = fields(&format!(
            r#"{{"path":"  /memes/x  ","params":{{"meme_id":" {MEME} ","surface":"{}","format":"\tcard\n","locale":"ko-KR-x-very-long","ignored":1}}}}"#,
            "s".repeat(81)
        ))
        .expect("fields");

        assert_eq!(read.meme_id.as_deref(), Some(MEME));
        assert_eq!(read.surface, Some("s".repeat(80)));
        assert_eq!(read.format.as_deref(), Some("card"));
        assert_eq!(read.locale.as_deref(), Some("ko-KR-x-very"));
        assert_eq!(read.path.as_deref(), Some("/memes/x"));
        // `meme_id` is also a metadata key, trimmed like any other string.
        assert_eq!(read.metadata, format!(r#"{{"meme_id":"{MEME}"}}"#));
        assert_eq!(
            read.dedupe_key,
            format!("client:{SESSION}:copy:{MEME}:29924000")
        );
    }

    #[test]
    fn blank_or_non_string_fields_are_null_and_params_must_be_an_object() {
        let empty = EventFields {
            meme_id: None,
            surface: None,
            format: None,
            locale: None,
            path: None,
            dedupe_key: format!("client:{SESSION}:copy:event:29924000"),
            metadata: "{}".to_owned(),
        };

        for body in [
            "{}",
            r#"{"params":null}"#,
            r#"{"params":[{"surface":"s"}]}"#,
            r#"{"params":"surface"}"#,
            r#"{"path":"   ","params":{"surface":" \u00a0","format":7,"locale":null,"meme_id":""}}"#,
            r#"{"path":["/x"],"params":{"meme_id":{"id":1}}}"#,
        ] {
            assert_eq!(fields(body).as_ref(), Some(&empty), "{body}");
        }
    }

    #[test]
    fn a_meme_id_that_is_not_a_uuid_is_refused() {
        assert_eq!(fields(r#"{"params":{"meme_id":"nope"}}"#), None);
        // Cut to 36 units before the check: one character too many passes.
        assert!(fields(&format!(r#"{{"params":{{"meme_id":"{MEME}x"}}}}"#)).is_some());
        assert_eq!(
            fields(&format!(r#"{{"params":{{"meme_id":"x{MEME}"}}}}"#)),
            None
        );
    }

    #[test]
    fn identity_prefers_meme_then_brief_then_format_surface_path() {
        let all = format!(
            r#"{{"path":"/p","params":{{"meme_id":"{MEME}","brief_id":"b1","position":3,"format":"f","surface":"s"}}}}"#
        );

        assert!(dedupe_key(&all).ends_with(&format!(":copy:{MEME}:29924000")));
        for (body, identity) in [
            (
                r#"{"path":"/p","params":{"brief_id":"b1","position":3,"format":"f","surface":"s"}}"#,
                "b1:3",
            ),
            (r#"{"params":{"brief_id":"b1","format":"f"}}"#, "b1:open"),
            (r#"{"params":{"brief_id":"b1","position":"3"}}"#, "b1:open"),
            (r#"{"params":{"brief_id":"b1","position":1.5}}"#, "b1:open"),
            (r#"{"params":{"brief_id":"b1","position":-0}}"#, "b1:0"),
            (
                r#"{"params":{"brief_id":"b1","position":1e21}}"#,
                "b1:1e+21",
            ),
            (
                r#"{"path":"/p","params":{"format":"f","surface":"s","position":3}}"#,
                "f",
            ),
            (r#"{"path":"/p","params":{"surface":"s"}}"#, "s"),
            (r#"{"path":"/p","params":{}}"#, "/p"),
        ] {
            assert_eq!(
                dedupe_key(body),
                format!("client:{SESSION}:copy:{identity}:29924000"),
                "{body}"
            );
        }
    }

    #[test]
    fn dedupe_key_is_cut_at_220_units_even_through_a_pair() {
        // 49 units of prefix, then 170 and an astral character: the cut
        // falls between its two halves, which Postgres receives as U+FFFD.
        let key = dedupe_key(&format!(r#"{{"path":"{}😀"}}"#, "x".repeat(170)));

        assert_eq!(key.encode_utf16().count(), 220);
        assert!(key.ends_with(&format!("{}\u{fffd}", "x".repeat(170))));
        assert_eq!(key.len(), 222);
    }

    #[test]
    fn metadata_keeps_allowed_strings_and_numbers_in_order_up_to_twelve() {
        let metadata = |params: &str| {
            fields(&format!(r#"{{"params":{params}}}"#))
                .expect("fields")
                .metadata
        };

        assert_eq!(
            metadata(
                r#"{"score":7,"unknown":"x","result":" win ","state":"","mode":true,"to":null,"source":["a"],"method":{"a":1},"channel":"  ","medium":0.5,"score":8}"#
            ),
            r#"{"score":8,"result":"win","medium":0.5}"#
        );
        assert_eq!(
            metadata(&format!(r#"{{"result":"{}"}}"#, "가".repeat(101))),
            format!(r#"{{"result":"{}"}}"#, "가".repeat(100))
        );
        // Thirteen allowed entries: the thirteenth is dropped.
        assert_eq!(
            metadata(
                r#"{"result":1,"state":2,"channel":3,"brief_id":"b","item_count":5,"position":6,"source":7,"method":8,"to":9,"mode":10,"score":11,"medium":12,"resolved_by":13}"#
            ),
            r#"{"result":1,"state":2,"channel":3,"brief_id":"b","item_count":5,"position":6,"source":7,"method":8,"to":9,"mode":10,"score":11,"medium":12}"#
        );
        // An entry that is left out does not count towards the twelve.
        assert!(
            metadata(
                r#"{"result":null,"state":2,"channel":3,"brief_id":"b","item_count":5,"position":6,"source":7,"method":8,"to":9,"mode":10,"score":11,"medium":12,"resolved_by":13}"#
            )
            .ends_with(r#""resolved_by":13}"#)
        );
    }

    #[test]
    fn metadata_strings_are_quoted_as_json_stringify_quotes_them() {
        let quoted = |text: &str| json_string(&text.encode_utf16().collect::<Vec<u16>>());

        assert_eq!(
            quoted("q\"b\\s/\u{8}\u{c}\n\r\t\u{1}\u{1f}\u{7f}\u{2028}é밈😀"),
            "\"q\\\"b\\\\s/\\b\\f\\n\\r\\t\\u0001\\u001f\u{7f}\u{2028}é밈😀\""
        );
        // A string cut through a pair: JSON.stringify writes the half as an
        // escape, which Postgres does not accept as jsonb.
        let cut = fields(&format!(
            r#"{{"params":{{"result":"{}😀"}}}}"#,
            "x".repeat(99)
        ))
        .expect("fields");
        assert_eq!(
            cut.metadata,
            format!(r#"{{"result":"{}\ud83d"}}"#, "x".repeat(99))
        );
    }

    // Expected values are what Node prints for String(number).
    #[test]
    fn numbers_are_written_as_javascript_writes_them() {
        for (number, text) in [
            (1.0, "1"),
            (1.5, "1.5"),
            (-42.0, "-42"),
            (1e21, "1e+21"),
            (1e20, "100000000000000000000"),
            (123_456_789_012_345_680_000.0, "123456789012345680000"),
            (1.2345e25, "1.2345e+25"),
            (0.000_001, "0.000001"),
            (1e-7, "1e-7"),
            (1.5e-7, "1.5e-7"),
            (-0.0, "0"),
            (0.1 + 0.2, "0.30000000000000004"),
            (9_007_199_254_740_993.0, "9007199254740992"),
            (5e-324, "5e-324"),
            (f64::MAX, "1.7976931348623157e+308"),
            (18_446_744_073_709_551_615.0, "18446744073709552000"),
            (100.0, "100"),
            (0.5, "0.5"),
            (123.456, "123.456"),
            (1.25e-6, "0.00000125"),
            (12_345_678_901_234_567_890_123.0, "1.2345678901234568e+22"),
            (-1e-7, "-1e-7"),
            (4.35, "4.35"),
            (0.000_123, "0.000123"),
        ] {
            assert_eq!(js_number_text(number), text);
        }
    }

    #[test]
    fn timestamp_is_utc_with_three_fraction_digits() {
        let instant = OffsetDateTime::from_unix_timestamp_nanos(1_795_446_000_007_000_000).unwrap();

        // new Date(1795446000007).toISOString()
        assert_eq!(iso_timestamp(instant), "2026-11-23T15:00:00.007Z");
    }
}
