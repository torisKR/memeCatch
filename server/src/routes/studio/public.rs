//! `POST /api/meme-studio`: `app/api/meme-studio/route.ts`. Route id
//! `meme-studio`. Three template concepts for a topic; no model is called.
//!
//! The order is the TypeScript's: the body (4 KiB, JSON), the schema, then
//! the in-memory limit of 10 an hour per client address, so a refused body
//! does not count.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::extract::{ConnectInfo, Request};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, RETRY_AFTER};
use axum::response::Response;
use serde::Serialize;

use super::{Concept, FORMATS, TONES, templates};
use crate::routes::public::csp_report::now_ms;
use crate::routes::public::js;
use crate::routes::public::rate_limit::{self, RateLimit, RateLimiter};
use crate::routes::request::{self, Json};

const MAX_BODY_BYTES: usize = 4 * 1024;
const LIMIT: usize = 10;
const WINDOW_MS: i64 = 60 * 60 * 1000;
const BAD_JSON: &str = "JSON 요청 본문이 올바르지 않습니다.";
const BAD_INPUT: &str = "topic(2~120자), tone, format을 올바르게 보내 주세요.";
const LIMITED: &str = "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";

#[derive(Serialize)]
struct Failure<'a> {
    error: &'a str,
}

fn failure(status: StatusCode, error: &str) -> Response {
    let body = serde_json::to_string(&Failure { error }).expect("a string serializes");
    request::json(status, body)
}

#[derive(Serialize)]
struct Templates<'a> {
    mode: &'a str,
    concepts: Vec<Concept>,
}

/// `bodySchema.safeParse(payload)`: the trimmed topic, the tone and format.
fn parsed(payload: &Json) -> Option<(String, &str, &str)> {
    let entries = payload.as_object()?;
    let text = |key| request::property(entries, key).and_then(Json::as_str);
    let topic = js::trim(text("topic")?);
    let tone = text("tone").filter(|tone| TONES.contains(tone))?;
    let format = text("format").filter(|format| FORMATS.contains(format))?;
    (2..=120)
        .contains(&js::utf16_len(topic))
        .then(|| (topic.to_owned(), tone, format))
}

pub async fn generate(limiter: Arc<RateLimiter>, request: Request) -> Response {
    let (parts, body) = request.into_parts();
    let Ok(text) = request::read_bounded_text(&parts.headers, body, MAX_BODY_BYTES).await else {
        return failure(StatusCode::BAD_REQUEST, BAD_JSON);
    };
    let Some(payload) = Json::parse(&text) else {
        return failure(StatusCode::BAD_REQUEST, BAD_JSON);
    };
    let Some((topic, tone, format)) = parsed(&payload) else {
        return failure(StatusCode::BAD_REQUEST, BAD_INPUT);
    };
    let peer = parts
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let key = [
        b"meme-studio:",
        rate_limit::client_ip(&parts.headers, peer).as_slice(),
    ]
    .concat();
    if let RateLimit::Limited { retry_after_sec } = limiter.check(key, LIMIT, WINDOW_MS, now_ms()) {
        let mut response = failure(StatusCode::TOO_MANY_REQUESTS, LIMITED);
        response
            .headers_mut()
            .insert(RETRY_AFTER, retry_after_sec.into());
        return response;
    }
    let concepts = templates::concepts(&topic, tone, format);
    let body = Templates {
        mode: "template",
        concepts,
    };
    let mut response = request::json(
        StatusCode::OK,
        serde_json::to_string(&body).expect("strings serialize"),
    );
    response
        .headers_mut()
        .insert(CACHE_CONTROL, "no-store".parse().expect("a header value"));
    response
}
