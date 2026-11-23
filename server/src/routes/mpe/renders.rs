//! `POST /api/mpe/renders`: `app/api/mpe/renders/route.ts`.
//!
//! Meant to queue a render job for one of the caller's ingestions through
//! `queue_metered_mpe_render_job`, as the signed-in user. As the TypeScript
//! stands the call never reaches the function (see `QUEUE_SQL`), so a valid
//! request is answered 400 and no row is written. That is what Next does
//! today, and what this does.

use std::sync::Arc;

use axum::body::to_bytes;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::response::Response;
use serde::Serialize;
use serde_json::Value;

use super::{failure, no_store, rate_limited};
use crate::AppState;
use crate::auth::{AuthRejection, SignedInUser};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::origin::request_is_trusted;
use crate::routes::public::csp_report::declares_too_large;
use crate::routes::public::js;
use crate::routes::public::rate_limit::RateLimiter;

const MAX_BODY_BYTES: usize = 64 * 1024;
const RATE_LIMIT: usize = 5;
const MAX_MS: f64 = 21_600_000.0;
const MAX_TEXT_CHARS: usize = 500;
const MAX_SEGMENTS: usize = 100;
const PRESETS: [&str; 3] = ["vertical", "square", "link"];
/// `Number.MAX_SAFE_INTEGER`: `z.number().int()` takes safe integers only.
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

// What lib/db/execute.ts sends for the call. It reads the argument types of
// the function as text where it expects an array, so no argument gets its
// cast and an array argument is sent as `text[]`. Postgres has no
// `queue_metered_mpe_render_job(..., text[], ...)`, so the statement fails and
// the route answers 400 `render_not_available` to every request that passes
// validation: no job is queued and nothing is metered. Ported as it is; when
// the TypeScript is fixed, `$2::text[]` becomes `$2::jsonb` here.
const QUEUE_SQL: &str = r#"WITH __q AS (SELECT public."queue_metered_mpe_render_job"("p_ingestion_id" => $1, "p_segments" => $2::text[], "p_preset" => $3, "p_attribution" => $4) AS result) SELECT row_to_json(__q)::text FROM __q"#;

/// One subtitle segment, as `JSON.stringify` writes the parsed value.
#[derive(Debug, PartialEq, Serialize)]
struct Segment {
    #[serde(rename = "startMs")]
    start_ms: i64,
    #[serde(rename = "endMs")]
    end_ms: i64,
    text: String,
}

/// `requestSchema`'s output: strings trimmed, numbers integers.
#[derive(Debug, PartialEq)]
struct RenderRequest {
    ingestion_id: String,
    preset: String,
    attribution: String,
    segments: Vec<Segment>,
}

/// `z.uuid()` of zod 4: versions 1 to 8 with the RFC variant, the nil UUID,
/// or the max UUID in lower case.
pub(super) fn is_zod_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    let shaped = bytes.len() == 36
        && bytes.iter().enumerate().all(|(index, byte)| match index {
            8 | 13 | 18 | 23 => *byte == b'-',
            _ => byte.is_ascii_hexdigit(),
        });
    shaped
        && ((matches!(bytes[14], b'1'..=b'8')
            && matches!(bytes[19], b'8' | b'9' | b'a' | b'b' | b'A' | b'B'))
            || value == "00000000-0000-0000-0000-000000000000"
            || value == "ffffffff-ffff-ffff-ffff-ffffffffffff")
}

/// `z.string().trim().min(1).max(500)`: the trimmed text, counted in UTF-16
/// units as JavaScript counts.
fn trimmed_text(value: &Value) -> Option<String> {
    let text = js::trim(value.as_str()?);
    (1..=MAX_TEXT_CHARS)
        .contains(&js::utf16_len(text))
        .then(|| text.to_owned())
}

/// `z.number().int().min(min).max(21_600_000)`. JSON `1.0` and `1e3` are
/// integers to JavaScript.
fn milliseconds(value: &Value, min: f64) -> Option<i64> {
    let number = value.as_f64().filter(|_| value.is_number())?;
    let is_int = number.fract() == 0.0 && number.abs() <= MAX_SAFE_INTEGER;
    (is_int && number >= min && number <= MAX_MS).then_some(number as i64)
}

/// The fields of a strict object: exactly `keys`, in that order.
fn strict_fields<'a, const N: usize>(value: &'a Value, keys: [&str; N]) -> Option<[&'a Value; N]> {
    let map = value.as_object().filter(|map| map.len() == N)?;
    let mut fields = [&Value::Null; N];
    for (field, key) in fields.iter_mut().zip(keys) {
        *field = map.get(key)?;
    }
    Some(fields)
}

/// `segmentSchema`.
fn segment(value: &Value) -> Option<Segment> {
    let [start_ms, end_ms, text] = strict_fields(value, ["startMs", "endMs", "text"])?;
    let segment = Segment {
        start_ms: milliseconds(start_ms, 0.0)?,
        // `.positive()`: above zero.
        end_ms: milliseconds(end_ms, 1.0)?,
        text: trimmed_text(text)?,
    };
    (segment.end_ms > segment.start_ms).then_some(segment)
}

/// `requestSchema.safeParse(payload)`: `None` when it does not parse.
fn render_request(payload: &Value) -> Option<RenderRequest> {
    let [ingestion_id, preset, attribution, segments] = strict_fields(
        payload,
        ["ingestionId", "preset", "attribution", "segments"],
    )?;
    let segments = segments
        .as_array()
        .filter(|segments| (1..=MAX_SEGMENTS).contains(&segments.len()))?
        .iter()
        .map(segment)
        .collect::<Option<Vec<_>>>()?;
    let sorted = segments
        .windows(2)
        .all(|pair| pair[1].start_ms >= pair[0].start_ms);
    Some(RenderRequest {
        ingestion_id: ingestion_id
            .as_str()
            .filter(|id| is_zod_uuid(id))?
            .to_owned(),
        preset: preset
            .as_str()
            .filter(|preset| PRESETS.contains(preset))?
            .to_owned(),
        attribution: trimmed_text(attribution)?,
        segments,
    })
    .filter(|_| sorted)
}

/// `readBoundedJson(request, 64 * 1024).catch(() => null)`.
async fn read_payload(request: Request) -> Value {
    if declares_too_large(request.headers(), MAX_BODY_BYTES) {
        return Value::Null;
    }
    let Ok(body) = to_bytes(request.into_body(), MAX_BODY_BYTES).await else {
        return Value::Null;
    };
    // TextDecoder: invalid bytes become U+FFFD and a leading BOM is dropped.
    let text = String::from_utf8_lossy(&body);
    serde_json::from_str(text.strip_prefix('\u{feff}').unwrap_or(&text)).unwrap_or(Value::Null)
}

/// The queued (or already existing) job: its id and status.
async fn queue_job(
    db: &Db,
    identity: &DbIdentity,
    request: RenderRequest,
) -> Result<Option<(String, String)>, sqlx::Error> {
    // One array element per segment, as node-pg writes an array of objects.
    let segments: Vec<String> = request
        .segments
        .iter()
        .map(|segment| serde_json::to_string(segment).expect("a segment serializes"))
        .collect();
    let row: Option<String> = db
        .with_identity(identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(QUEUE_SQL)
                    .persistent(false)
                    .bind(request.ingestion_id)
                    .bind(segments)
                    .bind(request.preset)
                    .bind(request.attribution)
                    .fetch_optional(tx)
                    .await
            })
        })
        .await?;
    let result = row
        .and_then(|row| serde_json::from_str::<Value>(&row).ok())
        .map(|row| row["result"].clone());
    Ok(result.and_then(|job| {
        Some((
            job["id"].as_str()?.to_owned(),
            job["status"].as_str()?.to_owned(),
        ))
    }))
}

pub async fn queue(
    State(state): State<AppState>,
    limiter: Arc<RateLimiter>,
    request: Request,
) -> Response {
    if !request_is_trusted(&state, request.headers()) {
        return failure(StatusCode::FORBIDDEN, "invalid_origin");
    }
    let (mut parts, body) = request.into_parts();
    let user = <SignedInUser as axum::extract::FromRequestParts<AppState>>::from_request_parts(
        &mut parts, &state,
    )
    .await;
    // `createClient()` treats a failed session lookup as signed out.
    let Ok(SignedInUser(user)): Result<_, AuthRejection> = user else {
        return failure(StatusCode::UNAUTHORIZED, "signed_out");
    };
    if let Some(limited) = rate_limited(&limiter, format!("mpe-render:{}", user.id), RATE_LIMIT) {
        return limited;
    }
    let payload = read_payload(Request::from_parts(parts, body)).await;
    let Some(render) = render_request(&payload) else {
        return failure(StatusCode::BAD_REQUEST, "invalid_render_request");
    };
    match queue_job(&state.db, &user.db_identity(), render).await {
        Ok(Some((id, status))) => {
            let code = if status == "queued" {
                StatusCode::ACCEPTED
            } else {
                StatusCode::OK
            };
            let body = format!(
                r#"{{"ok":true,"data":{{"jobId":{},"status":{}}}}}"#,
                serde_json::to_string(&id).expect("a string serializes"),
                serde_json::to_string(&status).expect("a string serializes"),
            );
            no_store(code, body)
        }
        Err(error) if error.to_string().contains("api_rate_limited") => {
            failure(StatusCode::TOO_MANY_REQUESTS, "rate_limited")
        }
        Ok(None) | Err(_) => failure(StatusCode::BAD_REQUEST, "render_not_available"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const ID: &str = "a1000000-0000-4000-8000-000000000001";

    fn request(change: impl FnOnce(&mut Value)) -> Option<RenderRequest> {
        let mut payload = json!({
            "ingestionId": ID, "preset": "vertical", "attribution": "  출처  ",
            "segments": [
                { "startMs": 0, "endMs": 1000.0, "text": " 첫 줄 " },
                { "startMs": 1e3, "endMs": 2000, "text": "둘째 줄" },
            ],
        });
        change(&mut payload);
        render_request(&payload)
    }

    #[test]
    fn a_valid_request_is_trimmed_and_its_numbers_are_integers() {
        let parsed = request(|_| {}).unwrap();

        assert_eq!(parsed.attribution, "출처");
        assert_eq!(
            serde_json::to_string(&parsed.segments).unwrap(),
            r#"[{"startMs":0,"endMs":1000,"text":"첫 줄"},{"startMs":1000,"endMs":2000,"text":"둘째 줄"}]"#
        );
    }

    // Each case is refused by the zod schema of the route as well.
    #[test]
    fn each_broken_rule_refuses_the_request() {
        type Change = fn(&mut Value);
        let cases: [(&str, Change); 20] = [
            ("unknown key", |p| p["extra"] = json!(1)),
            ("missing key", |p| {
                p.as_object_mut().unwrap().remove("preset");
            }),
            ("id not a uuid", |p| p["ingestionId"] = json!("not-a-uuid")),
            ("uuid version 0", |p| {
                p["ingestionId"] = json!("a1000000-0000-0000-8000-000000000001")
            }),
            ("uuid variant c", |p| {
                p["ingestionId"] = json!("a1000000-0000-4000-c000-000000000001")
            }),
            ("preset not listed", |p| p["preset"] = json!("wide")),
            ("blank attribution", |p| p["attribution"] = json!(" \n ")),
            ("attribution of 501", |p| {
                p["attribution"] = json!("가".repeat(501))
            }),
            ("no segments", |p| p["segments"] = json!([])),
            ("101 segments", |p| {
                p["segments"] = json!(vec![json!({"startMs": 0, "endMs": 1, "text": "x"}); 101])
            }),
            ("segments not an array", |p| p["segments"] = json!({})),
            ("unknown segment key", |p| p["segments"][0]["id"] = json!(1)),
            ("fractional start", |p| {
                p["segments"][0]["startMs"] = json!(0.5)
            }),
            ("negative start", |p| {
                p["segments"][0]["startMs"] = json!(-1)
            }),
            ("start as text", |p| {
                p["segments"][0]["startMs"] = json!("0")
            }),
            ("end of zero", |p| p["segments"][0]["endMs"] = json!(0)),
            ("end beyond six hours", |p| {
                p["segments"][1]["endMs"] = json!(21_600_001)
            }),
            ("end not after start", |p| {
                p["segments"][1]["endMs"] = json!(1000)
            }),
            ("blank text", |p| {
                p["segments"][0]["text"] = json!("\u{feff}")
            }),
            ("segments out of order", |p| {
                p["segments"][0]["startMs"] = json!(1500)
            }),
        ];
        for (name, change) in cases {
            assert_eq!(request(change), None, "{name}");
        }
        assert_eq!(render_request(&Value::Null), None);
        assert_eq!(render_request(&json!([])), None);
    }

    #[test]
    fn the_edges_zod_accepts_are_accepted() {
        assert!(request(|p| p["ingestionId"] = json!(ID.to_uppercase())).is_some());
        assert!(
            request(|p| p["ingestionId"] = json!("00000000-0000-0000-0000-000000000000")).is_some()
        );
        assert!(request(|p| p["attribution"] = json!("가".repeat(500))).is_some());
        // Equal starts are sorted; six hours is the last instant.
        assert!(request(|p| p["segments"][1]["startMs"] = json!(0)).is_some());
        assert!(request(|p| p["segments"][1]["endMs"] = json!(21_600_000)).is_some());
        assert!(request(|p| p["segments"][0]["startMs"] = json!(-0.0)).is_some());
    }
}
