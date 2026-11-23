//! `requestOpenRouterStructured` of lib/mpe/openrouter.server.ts, as the
//! evidence draft uses it: up to two tries for one JSON object (the second
//! with a correction message), each request preceded by a reservation of
//! the daily OpenRouter budget, transient failures retried, four requests
//! at most.
//!
//! Every failure but the budget's is a plain `Error` in the TypeScript,
//! which the route answers with 500 `mpe_candidate_failed`; its message
//! never leaves the server, so this port only tells the two apart.

use std::time::Duration;

use axum::http::StatusCode;
use url::Url;

use crate::AppState;
use crate::config::OpenRouterConfig;
use crate::db::{DbIdentity, IdentityOptions};
use crate::routes::openrouter::{self, Answer, OpenRouter};
use crate::routes::public::js;
use crate::routes::request::{self, Json};

pub const DEFAULT_MODEL: &str = "stealth/ox-alpha";
pub const BUDGET_EXHAUSTED: &str = "openrouter_daily_budget_exhausted";
const MAX_PROVIDER_ATTEMPTS: usize = 3;
const MAX_STRUCTURE_ATTEMPTS: usize = 2;
const MAX_TOTAL_PROVIDER_REQUESTS: usize = 4;
const MAX_RETRY_DELAY_MS: f64 = 10_000.0;
const TIMEOUT: Duration = Duration::from_secs(90);
const MAX_ANSWER_BYTES: usize = 512 * 1024;
const CORRECTION: &str = "The previous response was invalid. Return exactly one JSON object matching the requested schema, with no prose or code fence.";
const RESERVE_SQL: &str = r#"WITH __q AS (SELECT public."reserve_openrouter_daily_request"("p_provider" => $1, "p_model" => $2) AS result) SELECT row_to_json(__q)::text FROM __q"#;

/// Why no object came back.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Failure {
    /// `openrouter_daily_budget_exhausted`.
    BudgetExhausted,
    /// `openrouter_budget_reservation_failed`.
    ReservationFailed,
    /// Anything else.
    Plain,
}

/// `getMpeVisionModel()`: the one model, or `None` where it throws.
pub fn model(config: &OpenRouterConfig) -> Option<&'static str> {
    let configured = config
        .mpe_model
        .as_deref()
        .map(js::trim)
        .unwrap_or_default();
    (configured.is_empty() || configured == DEFAULT_MODEL).then_some(DEFAULT_MODEL)
}

/// `OPENROUTER_API_KEY?.trim()`, when set.
pub fn key(config: &OpenRouterConfig) -> Option<String> {
    let key = js::trim(config.api_key.as_ref()?.expose());
    (!key.is_empty()).then(|| key.to_owned())
}

/// `baseUrl()` + `/chat/completions`, as a path on `https://openrouter.ai`.
/// `None` where `baseUrl` throws (production rules: https, that origin, no
/// credentials).
fn completions_path(config: &OpenRouterConfig) -> Option<String> {
    let configured = config
        .base_url
        .as_deref()
        .map(js::trim)
        .filter(|base| !base.is_empty());
    let configured = configured
        .unwrap_or("https://openrouter.ai/api/v1")
        .trim_end_matches('/');
    let url = Url::parse(configured).ok()?;
    let fits = url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && url.origin().ascii_serialization() == openrouter::ORIGIN;
    let base = fits.then(|| url.to_string())?;
    Some(format!(
        "{}/chat/completions",
        &base.trim_end_matches('/')[openrouter::ORIGIN.len()..]
    ))
}

/// The request body: `requestValidatedJson`'s spread of the structured body.
pub fn body(system: &str, input: &str, max_tokens: u64, correction: bool) -> String {
    let string = |text: &str| serde_json::to_string(text).expect("a string serializes");
    let extra = if correction {
        format!(r#",{{"role":"system","content":{}}}"#, string(CORRECTION))
    } else {
        String::new()
    };
    format!(
        concat!(
            r#"{{"response_format":{{"type":"json_object"}},"max_tokens":{max_tokens},"#,
            r#""messages":[{{"role":"system","content":{system}}},{{"role":"user","content":{input}}}{extra}],"#,
            r#""model":"{model}","provider":{{"allow_fallbacks":false,"max_price":{{"prompt":0,"completion":0,"request":0,"image":0}}}}}}"#
        ),
        max_tokens = max_tokens,
        system = string(system),
        input = string(input),
        extra = extra,
        model = DEFAULT_MODEL,
    )
}

/// `reserveEvidenceDraftRequest(client)` and the classification of its error.
async fn reserve(state: &AppState, user: &DbIdentity) -> Result<(), Failure> {
    let result: Result<Vec<String>, sqlx::Error> = state
        .db
        .with_identity(user, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(RESERVE_SQL)
                    .persistent(false)
                    .bind("openrouter")
                    .bind(DEFAULT_MODEL)
                    .fetch_all(tx)
                    .await
            })
        })
        .await;
    let Err(error) = result else {
        return Ok(());
    };
    let database = error.as_database_error();
    let exhausted = database.is_some_and(|database| {
        database.message() == BUDGET_EXHAUSTED
            || database.code().as_deref() == Some(BUDGET_EXHAUSTED)
            || super::rows::detail(&error).as_deref() == Some(BUDGET_EXHAUSTED)
    });
    Err(if exhausted {
        Failure::BudgetExhausted
    } else {
        Failure::ReservationFailed
    })
}

/// `Number(text)` for the forms a `Retry-After` can take; `None` is `NaN`.
fn js_number(text: &str) -> Option<f64> {
    let digits = |part: &str| !part.is_empty() && part.bytes().all(|byte| byte.is_ascii_digit());
    for (prefix, radix) in [
        ("0x", 16),
        ("0X", 16),
        ("0o", 8),
        ("0O", 8),
        ("0b", 2),
        ("0B", 2),
    ] {
        if let Some(rest) = text.strip_prefix(prefix) {
            return u64::from_str_radix(rest, radix)
                .ok()
                .map(|value| value as f64);
        }
    }
    let unsigned = text.strip_prefix(['+', '-']).unwrap_or(text);
    if unsigned == "Infinity" {
        return Some(if text.starts_with('-') {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        });
    }
    let (mantissa, exponent) = match unsigned.find(['e', 'E']) {
        Some(at) => (&unsigned[..at], Some(&unsigned[at + 1..])),
        None => (unsigned, None),
    };
    let (whole, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    let mantissa_ok = (digits(whole) || whole.is_empty())
        && (digits(fraction) || fraction.is_empty())
        && !(whole.is_empty() && fraction.is_empty());
    let exponent_ok = exponent
        .is_none_or(|exponent| digits(exponent.strip_prefix(['+', '-']).unwrap_or(exponent)));
    (mantissa_ok && exponent_ok)
        .then(|| text.parse().ok())
        .flatten()
}

/// `Date.parse(text)` for an HTTP date (`Wed, 21 Oct 2015 07:28:00 GMT`), in ms.
fn http_date(text: &str) -> Option<f64> {
    let format = time::format_description::parse_borrowed::<2>(
        "[weekday repr:short], [day] [month repr:short] [year] [hour]:[minute]:[second] GMT",
    )
    .ok()?;
    let at = time::PrimitiveDateTime::parse(text, &format)
        .ok()?
        .assume_utc();
    Some((at.unix_timestamp_nanos() / 1_000_000) as f64)
}

/// `retryDelayMs(response, attempt)`.
fn retry_delay(answer: Option<&Answer>, attempt: usize) -> Duration {
    let power = f64::from(1_u32 << attempt.min(16));
    let header = answer.and_then(|answer| {
        request::header_text(&answer.headers, &axum::http::header::RETRY_AFTER, ", ")
    });
    let header = header
        .as_deref()
        .map(js::trim)
        .filter(|value| !value.is_empty());
    let ms = if let Some(seconds) = header
        .and_then(js_number)
        .filter(|n| n.is_finite() && *n >= 0.0)
    {
        (seconds * 1000.0).min(MAX_RETRY_DELAY_MS)
    } else if let Some(date) = header.and_then(http_date) {
        let now = crate::routes::public::csp_report::now_ms() as f64;
        (date - now).clamp(0.0, MAX_RETRY_DELAY_MS)
    } else if answer.is_some_and(|answer| answer.status == StatusCode::TOO_MANY_REQUESTS) {
        (5000.0 * power).min(MAX_RETRY_DELAY_MS)
    } else {
        (250.0 * power).min(2000.0)
    };
    Duration::from_millis(ms as u64)
}

/// `isRetryableRateLimit(payload)`: OpenRouter's shared-pool message.
fn shared_pool(payload: Option<&Json>) -> bool {
    let error = payload
        .and_then(Json::as_object)
        .and_then(|entries| request::property(entries, "error"))
        .and_then(Json::as_object);
    let metadata = error
        .and_then(|error| request::property(error, "metadata"))
        .and_then(Json::as_object);
    let values = [
        error.and_then(|error| request::property(error, "message")),
        metadata.and_then(|metadata| request::property(metadata, "raw")),
    ];
    values
        .iter()
        .flatten()
        .filter_map(|value| value.as_str())
        .any(|value| {
            let lower = value.to_ascii_lowercase();
            [
                "sharedpool",
                "shared_pool",
                "shared-pool",
                "shared pool",
                "temporarily rate-limited upstream",
                "temporarily rate limited upstream",
            ]
            .iter()
            .any(|needle| lower.contains(needle))
        })
}

/// One provider exchange of `openRouterJson`, retried as the TypeScript
/// retries it; `remaining` is the shared request budget.
async fn provider_json(
    state: &AppState,
    client: &OpenRouter,
    config: &OpenRouterConfig,
    user: &DbIdentity,
    body: &str,
    remaining: &mut usize,
) -> Result<Option<Json>, Failure> {
    let key = key(config).ok_or(Failure::Plain)?;
    for attempt in 0.. {
        reserve(state, user).await?;
        *remaining -= 1;
        let can_retry = attempt < MAX_PROVIDER_ATTEMPTS - 1 && *remaining > 0;
        let sent = match completions_path(config) {
            Some(path) => client
                .post(&path, &key, body.to_owned(), TIMEOUT, MAX_ANSWER_BYTES)
                .await
                .ok(),
            None => None,
        };
        let Some(answer) = sent else {
            if can_retry {
                tokio::time::sleep(retry_delay(None, attempt)).await;
                continue;
            }
            return Err(Failure::Plain);
        };
        let raw = answer
            .body
            .as_deref()
            .map(request::decode_text)
            .unwrap_or_default();
        let payload = if raw.is_empty() {
            None
        } else {
            Some(Json::parse(&raw).ok_or(Failure::Plain)?)
        };
        if answer.status.is_success() {
            return Ok(payload);
        }
        let transient = matches!(answer.status.as_u16(), 502..=504)
            || (answer.status == StatusCode::TOO_MANY_REQUESTS && shared_pool(payload.as_ref()));
        if transient && can_retry {
            tokio::time::sleep(retry_delay(Some(&answer), attempt)).await;
            continue;
        }
        return Err(Failure::Plain);
    }
    Err(Failure::Plain)
}

/// `responseContent(payload)`: the trimmed content of the first choice.
fn content(payload: Option<&Json>) -> Option<String> {
    let choices = request::property(payload?.as_object()?, "choices")?;
    let Json::Array(choices) = choices else {
        return None;
    };
    let message = request::property(choices.first()?.as_object()?, "message")?.as_object()?;
    let text = js::trim(request::property(message, "content")?.as_str()?);
    (!text.is_empty()).then(|| text.to_owned())
}

/// `parseJsonObject(text)`: the text as one object, or the one balanced
/// object in it.
pub fn parse_json_object(text: &str) -> Option<Vec<(String, Json)>> {
    if let Some(Json::Object(entries)) = Json::parse(text) {
        return Some(entries);
    }
    let mut records = Vec::new();
    let (mut start, mut depth, mut in_string, mut escaped) = (None, 0_usize, false, false);
    for (at, c) in text.char_indices() {
        let Some(from) = start else {
            if c == '{' {
                (start, depth) = (Some(at), 1);
            }
            continue;
        };
        if in_string {
            if escaped {
                escaped = false;
            } else if c == '\\' {
                escaped = true;
            } else if c == '"' {
                in_string = false;
            }
            continue;
        }
        match c {
            '"' => in_string = true,
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    if let Some(Json::Object(entries)) = Json::parse(&text[from..=at]) {
                        records.push(entries);
                    }
                    start = None;
                }
            }
            _ => {}
        }
    }
    (records.len() == 1).then(|| records.pop()).flatten()
}

/// `requestOpenRouterStructured({ name, schema, instructions, input,
/// maxOutputTokens, reserveRequest })` with the system message already
/// written: the object, as parsed.
pub async fn request_structured(
    state: &AppState,
    client: &OpenRouter,
    config: &OpenRouterConfig,
    user: &DbIdentity,
    system: &str,
    input: &str,
    max_tokens: u64,
) -> Result<Vec<(String, Json)>, Failure> {
    model(config).ok_or(Failure::Plain)?;
    let mut remaining = MAX_TOTAL_PROVIDER_REQUESTS;
    for attempt in 0..MAX_STRUCTURE_ATTEMPTS {
        if remaining == 0 {
            break;
        }
        let body = body(system, input, max_tokens, attempt > 0);
        let payload = provider_json(state, client, config, user, &body, &mut remaining).await?;
        let content = content(payload.as_ref()).ok_or(Failure::Plain)?;
        if let Some(record) = parse_json_object(&content) {
            return Ok(record);
        }
    }
    Err(Failure::Plain)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn number_follows_javascripts_number_for_retry_after() {
        for (text, value) in [
            ("5", Some(5.0)),
            ("+1.5", Some(1.5)),
            (".5", Some(0.5)),
            ("5.", Some(5.0)),
            ("1e3", Some(1000.0)),
            ("0x10", Some(16.0)),
            ("-2", Some(-2.0)),
            ("Infinity", Some(f64::INFINITY)),
        ] {
            assert_eq!(js_number(text), value, "{text}");
        }
        for text in ["", ".", "1e", "inf", "NaN", "0x", "1,5", "5s", "infinity"] {
            assert_eq!(js_number(text), None, "{text}");
        }
        assert_eq!(
            http_date("Wed, 21 Oct 2015 07:28:00 GMT"),
            Some(1_445_412_480_000.0)
        );
    }

    #[test]
    fn the_object_is_found_in_prose_only_when_there_is_one() {
        let one =
            parse_json_object("prose {\"claims\": [1, {\"x\": \"}\"}]} more").expect("one object");
        assert_eq!(one[0].0, "claims");
        assert!(parse_json_object("{\"a\":1} and {\"b\":2}").is_none());
        assert!(parse_json_object("[1,2]").is_none());
        assert!(parse_json_object("{\"a\":1} {broken").is_some());
        assert!(parse_json_object("no object").is_none());
    }

    #[test]
    fn the_base_url_must_stay_on_openrouter() {
        let config = |base: Option<&str>| OpenRouterConfig {
            base_url: base.map(str::to_owned),
            ..OpenRouterConfig::default()
        };
        assert_eq!(
            completions_path(&config(None)).as_deref(),
            Some("/api/v1/chat/completions")
        );
        assert_eq!(
            completions_path(&config(Some(" https://openrouter.ai/x/// "))).as_deref(),
            Some("/x/chat/completions")
        );
        assert_eq!(
            completions_path(&config(Some("https://openrouter.ai"))).as_deref(),
            Some("/chat/completions")
        );
        for refused in [
            "http://openrouter.ai/api/v1",
            "https://u:p@openrouter.ai/api/v1",
            "https://example.com/api/v1",
            "nope",
        ] {
            assert_eq!(completions_path(&config(Some(refused))), None, "{refused}");
        }
    }
}
