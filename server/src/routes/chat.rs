//! `POST /api/memes/chat`: `app/api/memes/chat/route.ts` and
//! `answerMemeQuestion` (lib/meme-chat.server.ts). Route id `memes-chat`.
//!
//! A question is answered from the public records the keyword search finds:
//! a summary of them, or, when OpenRouter is configured, a generated answer
//! that cites them. With `Accept: application/x-ndjson` the answer streams:
//! progress lines first, then the result or an error. A client that goes
//! away stops the work, and the provider request when no one else waits for
//! it.
//!
//! Registered only when the semantic path cannot run (no usable
//! `MEME_EMBEDDING_URL`, as in production), like `memes-semantic-search`:
//! the references are then the keyword search's.

pub(crate) mod facts;
#[cfg(test)]
mod fixture_tests;
mod generate;
mod jobs;

use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::body::{Body, Bytes};
use axum::extract::{ConnectInfo, Request, State};
use axum::http::header::{ACCEPT, CACHE_CONTROL, CONTENT_TYPE, HeaderValue, RETRY_AFTER};
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use axum::routing::post;
use tokio::sync::mpsc;
use tokio::time::Instant;

use self::facts::{Fact, LOCALES, Unavailable};
use self::generate::{ENDPOINT, Generation};
use self::jobs::{Jobs, Lookup};
use super::Routes;
use super::openrouter::OpenRouter;
use super::public::csp_report::now_ms;
use super::public::js;
use super::public::rate_limit::{self, RateLimit, RateLimiter};
use super::request::{self, BodyError, Json, SiteOrigin};
use super::search;
use crate::AppState;

const MAX_BODY_BYTES: usize = 2048;
const DEADLINE: Duration = Duration::from_secs(25);
/// `[key prefix, limit, window]` of the two instance-local limits.
const LIMITS: [(&str, usize, i64); 2] = [
    ("meme-chat:ip:", 5, 600_000),
    ("meme-chat:instance", 20, 60_000),
];

pub struct Chat {
    site: SiteOrigin,
    limiter: RateLimiter,
    jobs: Arc<Jobs>,
    client: OpenRouter,
    generation: Option<Generation>,
}

pub fn router(state: &AppState) -> Router<AppState> {
    let routes = Routes::new(state);
    let config = &state.config;
    let semantic = search::embedding_endpoint_usable(
        config.semantic_search_enabled,
        config.embedding_url.as_deref(),
    );
    let (Some(site), false) = (SiteOrigin::from_site_url(&config.site_url), semantic) else {
        return routes.build();
    };
    let client = match OpenRouter::new(config.openrouter.test_origin.as_deref()) {
        Ok(client) => client,
        Err(error) => {
            tracing::error!(%error, "memes-chat left to the upstream");
            return routes.build();
        }
    };
    let chat = Arc::new(Chat {
        site,
        limiter: RateLimiter::new(now_ms()),
        jobs: Arc::new(Jobs::default()),
        client,
        generation: generate::generation(&config.openrouter),
    });
    routes
        .add(
            "memes-chat",
            "/api/memes/chat",
            post(move |state: State<AppState>, request: Request| {
                handle(state, chat.clone(), request)
            }),
        )
        .build()
}

/// The `headers` every answer of the route carries.
fn with_headers(mut response: Response) -> Response {
    let headers = response.headers_mut();
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("no-store"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    response
}

fn error(status: StatusCode, code: &str) -> Response {
    with_headers(request::json(status, format!(r#"{{"error":"{code}"}}"#)))
}

/// The two limits, IP first; `None` when the request may go on.
fn limited(limiter: &RateLimiter, parts: &axum::http::request::Parts) -> Option<Response> {
    let peer = parts
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let client = rate_limit::client_ip(&parts.headers, peer);
    for (prefix, limit, window) in LIMITS {
        let key = if prefix.ends_with(':') {
            [prefix.as_bytes(), client.as_slice()].concat()
        } else {
            prefix.as_bytes().to_vec()
        };
        if let RateLimit::Limited { retry_after_sec } = limiter.check(key, limit, window, now_ms())
        {
            let mut response = error(StatusCode::TOO_MANY_REQUESTS, "rate_limited");
            response
                .headers_mut()
                .insert(RETRY_AFTER, retry_after_sec.into());
            return Some(response);
        }
    }
    None
}

/// `memeChatRequestSchema` (strict): the trimmed question of 2 to 120 UTF-16
/// units and a locale, `ko` when absent.
pub struct Question {
    pub text: String,
    pub locale: &'static str,
}

fn question(payload: Option<&Json>) -> Option<Question> {
    let entries = payload?.as_object()?;
    if entries
        .iter()
        .any(|(key, _)| key != "question" && key != "locale")
    {
        return None;
    }
    let text = js::trim(request::property(entries, "question")?.as_str()?);
    let locale = match request::property(entries, "locale") {
        None => "ko",
        Some(value) => *LOCALES
            .iter()
            .find(|locale| value.as_str() == Some(locale))?,
    };
    (2..=120).contains(&js::utf16_len(text)).then(|| Question {
        text: text.to_owned(),
        locale,
    })
}

/// Whether `Accept` lists `application/x-ndjson` without `q=0`.
fn accepts_stream(headers: &HeaderMap) -> bool {
    let Some(accept) = request::header_text(headers, &ACCEPT, ", ") else {
        return false;
    };
    let refused = |parameter: &str| {
        let parameter = js::trim(parameter);
        let Some((name, value)) = parameter.split_once('=') else {
            return false;
        };
        let value = js::trim(value);
        let zero = value.strip_prefix('0').is_some_and(|rest| {
            rest.is_empty()
                || rest
                    .strip_prefix('.')
                    .is_some_and(|zeros| zeros.bytes().all(|b| b == b'0'))
        });
        js::trim(name).eq_ignore_ascii_case("q") && zero
    };
    accept.split(',').any(|value| {
        let mut parts = value.split(';');
        let media = parts.next().unwrap_or_default();
        js::trim(media).to_lowercase() == "application/x-ndjson" && !parts.any(refused)
    })
}

async fn handle(State(state): State<AppState>, chat: Arc<Chat>, request: Request) -> Response {
    let trusted = request::trusted_origin(request.headers(), &chat.site);
    if !trusted {
        return error(StatusCode::FORBIDDEN, "invalid_origin");
    }
    let (parts, body) = request.into_parts();
    if let Some(response) = limited(&chat.limiter, &parts) {
        return response;
    }
    let deadline = Instant::now() + DEADLINE;
    let read = request::read_bounded_text(&parts.headers, body, MAX_BODY_BYTES);
    let text = match tokio::time::timeout_at(deadline, read).await {
        Err(_) => return error(StatusCode::GATEWAY_TIMEOUT, "request_timed_out"),
        Ok(Err(BodyError::TooLarge)) => {
            return error(StatusCode::PAYLOAD_TOO_LARGE, "body_too_large");
        }
        Ok(Err(BodyError::Unreadable)) => {
            return error(StatusCode::BAD_REQUEST, "invalid_question");
        }
        Ok(Ok(text)) => text,
    };
    let Some(input) = question(Json::parse(&text).as_ref()) else {
        return error(StatusCode::BAD_REQUEST, "invalid_question");
    };
    if accepts_stream(&parts.headers) {
        return stream(state, chat, input, deadline);
    }
    match tokio::time::timeout_at(deadline, answer(&state, &chat, &input, &Progress(None))).await {
        Err(_) => error(StatusCode::GATEWAY_TIMEOUT, "request_timed_out"),
        Ok(Err(Unavailable)) => error(StatusCode::SERVICE_UNAVAILABLE, "search_unavailable"),
        Ok(Ok(result)) => with_headers(request::json(StatusCode::OK, result)),
    }
}

/// Where progress goes: the stream's lines, or nowhere.
struct Progress(Option<mpsc::Sender<Bytes>>);

impl Progress {
    fn emit(&self, stage: &str) {
        self.line(format!(
            r#"{{"type":"progress","progress":{{"stage":"{stage}"}}}}"#
        ));
    }

    fn found(&self, count: usize) {
        self.line(format!(
            r#"{{"type":"progress","progress":{{"stage":"found","count":{count}}}}}"#
        ));
    }

    fn line(&self, event: String) {
        if let Some(sender) = &self.0 {
            // At most five progress lines and one result fit the channel.
            let _ = sender.try_send(Bytes::from(event + "\n"));
        }
    }
}

/// `streamAnswer`: progress lines, then one result or error line.
fn stream(state: AppState, chat: Arc<Chat>, input: Question, deadline: Instant) -> Response {
    let (sender, mut receiver) = mpsc::channel::<Bytes>(8);
    tokio::spawn(async move {
        let progress = Progress(Some(sender.clone()));
        let terminal = tokio::select! {
            // The client went away: dropping the work cancels it.
            () = sender.closed() => return,
            () = tokio::time::sleep_until(deadline) => {
                r#"{"type":"error","error":"request_timed_out"}"#.to_owned()
            }
            result = answer(&state, &chat, &input, &progress) => match result {
                Ok(result) => format!(r#"{{"type":"result","result":{result}}}"#),
                Err(Unavailable) => r#"{"type":"error","error":"search_unavailable"}"#.to_owned(),
            },
        };
        let _ = sender.send(Bytes::from(terminal + "\n")).await;
    });
    let lines = futures_util::stream::poll_fn(move |context| {
        receiver
            .poll_recv(context)
            .map(|line| line.map(Ok::<_, Infallible>))
    });
    let mut response = with_headers(Response::new(Body::from_stream(lines)));
    response.headers_mut().insert(
        CONTENT_TYPE,
        HeaderValue::from_static("application/x-ndjson; charset=utf-8"),
    );
    response
}

/// The ids `searchMemeReferences(question, 4)` gives: UUIDs only, once each, four at most.
async fn reference_ids(state: &AppState, question: &str) -> Result<Vec<String>, Unavailable> {
    let references = search::keyword_search(state, question, 4)
        .await
        .map_err(|error| {
            tracing::error!(%error, "meme chat search unavailable");
            Unavailable
        })?;
    let mut ids: Vec<String> = Vec::new();
    for id in references.into_iter().map(|reference| reference.id) {
        if facts::is_uuid(&id) && !ids.contains(&id) {
            ids.push(id);
        }
    }
    ids.truncate(4);
    Ok(ids)
}

fn generated_json(value: &generate::Generated, facts: &[Fact], locale: &str) -> String {
    facts::generated(&value.answer, &value.citation_ids, facts, locale, "keyword")
}

/// `answerMemeQuestion(input, signal, onProgress)`: the result as JSON.
async fn answer(
    state: &AppState,
    chat: &Chat,
    input: &Question,
    progress: &Progress,
) -> Result<String, Unavailable> {
    let (question, locale) = (&input.text, input.locale);
    progress.emit("reading");
    progress.emit("searching");
    let ids = reference_ids(state, question).await?;
    let found = facts::exact_title_facts(question, facts::hydrate(state, &ids, locale).await?);
    progress.found(found.len());
    match (&chat.generation, found.is_empty()) {
        (Some(generation), false) => {
            generated_answer(state, chat, generation, input, found, progress).await
        }
        _ => Ok(facts::retrieved(&found, locale, "keyword")),
    }
}

/// The rest of `answerMemeQuestion` with generation on: the cached answer,
/// or the shared provider request, then the records read again.
async fn generated_answer(
    state: &AppState,
    chat: &Chat,
    generation: &Generation,
    input: &Question,
    found: Vec<Fact>,
    progress: &Progress,
) -> Result<String, Unavailable> {
    let (question, locale) = (&input.text, input.locale);
    let fingerprint = facts::fingerprint(&found);
    let parts = [
        "openrouter",
        "openrouter/free",
        ENDPOINT,
        question,
        locale,
        &fingerprint,
    ];
    let key = serde_json::to_string(&parts).expect("strings serialize");
    let (client, generation) = (chat.client.clone(), generation.clone());
    let (asked, records) = (question.clone(), found.clone());
    let start = move || async move {
        generate::generate(&client, &generation, &asked, locale, &records).await
    };
    let job = match chat.jobs.join(&key, start) {
        Lookup::Cached(value) => return Ok(generated_json(&value, &found, locale)),
        Lookup::Full => return Ok(facts::retrieved(&found, locale, "keyword")),
        Lookup::Job(job) => {
            progress.emit("answering");
            job
        }
    };
    let generated = jobs::wait(job).await;
    // Public visibility is checked again after the wait, as the TypeScript does.
    let ids: Vec<String> = found.iter().map(|fact| fact.item.id.clone()).collect();
    let current = facts::exact_title_facts(question, facts::hydrate(state, &ids, locale).await?);
    Ok(match generated {
        Some(value) if facts::fingerprint(&current) == fingerprint => {
            generated_json(&value, &current, locale)
        }
        _ => facts::retrieved(&current, locale, "keyword"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn accept(value: &str) -> bool {
        let mut headers = HeaderMap::new();
        headers.insert(ACCEPT, value.parse().expect("a header value"));
        accepts_stream(&headers)
    }

    #[test]
    fn only_an_ndjson_accept_without_q_zero_streams() {
        assert!(accept("application/x-ndjson"));
        assert!(accept("text/html, Application/X-NDJSON ;q=0.5"));
        assert!(accept("application/x-ndjson; q=0.01"));
        assert!(!accept("application/x-ndjson;q=0"));
        assert!(!accept("application/x-ndjson; Q = 0.000 "));
        assert!(!accept("application/json"));
        assert!(!accept("application/x-ndjson+json"));
        assert!(accept("application/x-ndjson;q=0;x=1, application/x-ndjson"));
    }

    #[test]
    fn the_question_schema_is_strict_and_trims() {
        let parse = |text: &str| question(Json::parse(text).as_ref()).map(|q| (q.text, q.locale));
        assert_eq!(
            parse(r#"{"question":"  밈 뜻 "}"#),
            Some(("밈 뜻".to_owned(), "ko"))
        );
        assert_eq!(
            parse(r#"{"question":"ab","locale":"zh-tw"}"#),
            Some(("ab".to_owned(), "zh-tw"))
        );
        assert_eq!(parse(r#"{"question":" a "}"#), None);
        assert_eq!(parse(r#"{"question":"ab","locale":"fr"}"#), None);
        assert_eq!(parse(r#"{"question":"ab","locale":null}"#), None);
        assert_eq!(parse(r#"{"question":"ab","x":1}"#), None);
        assert_eq!(
            parse(&format!(r#"{{"question":"{}"}}"#, "가".repeat(121))),
            None
        );
        assert_eq!(parse("[]"), None);
    }
}
