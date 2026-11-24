//! `POST /api/submit` (route id `submit-meme`): `submitMemeWithAttachment`
//! of app/(default)/submit/actions.ts, for the native `/submit` page
//! (`pages/account/submit.rs`, `assets/pages/submit.js`).
//!
//! Like the server action: another origin is refused, the body is the form
//! as JSON (each field a string, `attachmentPath` the path the form's upload
//! returned), and the answer is the action's state with 200 and the cookies
//! its session read set. Its messages are Korean on both servers: the action
//! reads the request locale, which `proxy.ts` sets to `ko` on `/submit`.
//!
//! In order: submissions closed, `createSubmitSchema` (each field's first
//! message), the session, the attachment's folder, `reserve_submission_attempt`,
//! the oEmbed check of a supported link (`crate::oembed`, R11), then
//! `submit_meme_v2`. `reserve_submission_attempt` is defined by no migration
//! in the repository; this calls it as the action does (PLAN.md B6-28).

use axum::Router;
use axum::extract::{Request, State};
use axum::http::header::SET_COOKIE;
use axum::http::{HeaderValue, StatusCode};
use axum::response::Response;
use axum::routing::post;
use serde_json::{Map, Value, json};

use super::Routes;
use super::better_auth::action_user;
use super::origin::request_is_trusted;
use super::public::js;
use super::request::{self, Json, property};
use crate::AppState;
use crate::db::{DbIdentity, IdentityOptions};
use crate::oembed::target::is_supported_url;
use crate::pages::account::copy;

/// The longest form the limits allow, with room for JSON escapes.
const MAX_BODY_BYTES: usize = 64 * 1024;
const SUBMIT_SQL: &str = "select public.submit_meme_v2($1, $2, $3, $4, $5, $6::text[], $7)::text";

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add("submit-meme", "/api/submit", post(submit))
        .build()
}

/// The form after `createSubmitSchema`: trimmed, empty strings kept.
#[derive(Debug, PartialEq, Eq)]
pub struct Input {
    pub name: String,
    pub seen_at: String,
    pub source_url: String,
    pub description: String,
    pub guess_reason: String,
    pub tags: String,
    pub attachment_path: String,
}

/// `/^https:\/\/\S+\.\S+/`: `https://`, then non-space, a dot, non-space.
fn looks_like_https_link(value: &str) -> bool {
    let Some(rest) = value.strip_prefix("https://") else {
        return false;
    };
    let run: Vec<char> = rest.chars().take_while(|c| !js::is_space(*c)).collect();
    // A dot with at least one character before and after it in the run.
    run.iter()
        .enumerate()
        .any(|(index, c)| *c == '.' && index > 0 && index + 1 < run.len())
}

/// `createSubmitSchema(copy)`: each field's first message, as the action
/// collects them into `fieldErrors`.
pub fn parse(entries: &[(String, Json)], errors: &Value) -> Result<Input, Map<String, Value>> {
    let message = |key: &str| Value::String(errors[key].as_str().unwrap_or_default().to_owned());
    let mut failed = Map::new();
    let mut field = |key: &str, max: usize, too_long: &str, required: Option<&str>| -> String {
        let raw = match property(entries, key) {
            Some(Json::String(value)) => value.clone(),
            None | Some(Json::Null) => String::new(),
            Some(_) => {
                failed.insert(
                    key.to_owned(),
                    Value::String("Invalid input: expected string".to_owned()),
                );
                return String::new();
            }
        };
        let value = js::trim(&raw).to_owned();
        let length = js::utf16_len(&value);
        if let Some(required) = required.filter(|_| length < 1) {
            failed.insert(key.to_owned(), message(required));
        } else if length > max {
            failed.insert(key.to_owned(), message(too_long));
        }
        value
    };
    let name = field("name", 100, "nameTooLong", Some("nameRequired"));
    let seen_at = field("seenAt", 200, "seenAtTooLong", None);
    let source_url = field("sourceUrl", 500, "sourceUrlTooLong", None);
    let description = field("description", 2000, "descriptionTooLong", None);
    let guess_reason = field("guessReason", 1000, "guessTooLong", None);
    let tags = field("tags", 300, "tagsTooLong", None);
    let attachment_path = field("attachmentPath", 300, "attachmentTooLong", None);
    if !source_url.is_empty()
        && !looks_like_https_link(&source_url)
        && !failed.contains_key("sourceUrl")
    {
        failed.insert("sourceUrl".to_owned(), message("sourceUrlInvalid"));
    }
    if failed.is_empty() {
        Ok(Input {
            name,
            seen_at,
            source_url,
            description,
            guess_reason,
            tags,
            attachment_path,
        })
    } else {
        Err(failed)
    }
}

/// `parseTags`: comma-separated, trimmed, 1 to 30 UTF-16 units, first of
/// each, at most ten.
pub fn parse_tags(raw: &str) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();
    for tag in raw.split(',').map(js::trim) {
        let length = js::utf16_len(tag);
        if length > 0 && length <= 30 && !tags.iter().any(|kept| kept == tag) {
            tags.push(tag.to_owned());
        }
    }
    tags.truncate(10);
    tags
}

fn state_error(field_errors: Map<String, Value>, form_error: Option<&str>) -> Value {
    let mut state = json!({ "status": "error", "fieldErrors": field_errors });
    if let Some(form_error) = form_error {
        state["formError"] = Value::String(form_error.to_owned());
    }
    state
}

fn field_error(key: &str, message: &str) -> Value {
    let mut fields = Map::new();
    fields.insert(key.to_owned(), Value::String(message.to_owned()));
    state_error(fields, None)
}

fn answer(body: Value, cookies: Vec<String>) -> Response {
    let mut response = request::json(StatusCode::OK, body.to_string());
    for line in cookies {
        if let Ok(value) = HeaderValue::try_from(line) {
            response.headers_mut().append(SET_COOKIE, value);
        }
    }
    response
}

fn database_error(error: &sqlx::Error) -> (Option<String>, String) {
    let database = error.as_database_error();
    (
        database
            .and_then(|e| e.code())
            .map(|code| code.into_owned()),
        database.map(|e| e.message().to_owned()).unwrap_or_default(),
    )
}

/// `submitMemeWithAttachment`.
async fn submit(State(state): State<AppState>, request: Request) -> Response {
    if !request_is_trusted(&state, request.headers()) {
        return request::json(
            StatusCode::FORBIDDEN,
            r#"{"status":"error","fieldErrors":{}}"#,
        );
    }
    let errors = &copy::submit("ko")["errors"];
    let text = |key: &str| errors[key].as_str().unwrap_or_default();
    if !state.config.submissions_open {
        return answer(
            state_error(Map::new(), Some(text("submissionsClosed"))),
            Vec::new(),
        );
    }
    let (parts, body) = request.into_parts();
    let entries = match request::read_at_most(body, MAX_BODY_BYTES).await {
        Ok(bytes) => Json::parse(&request::decode_text(&bytes))
            .and_then(|json| json.as_object().map(<[_]>::to_vec))
            .unwrap_or_default(),
        Err(_) => Vec::new(),
    };
    let input = match parse(&entries, errors) {
        Ok(input) => input,
        Err(failed) => return answer(state_error(failed, None), Vec::new()),
    };
    let (user, cookies) = action_user(&state, &parts.headers).await;
    let Some(user) = user else {
        return answer(
            state_error(Map::new(), Some(text("loginRequired"))),
            cookies,
        );
    };
    if !input.attachment_path.is_empty()
        && !input
            .attachment_path
            .starts_with(&format!("meme-uploads/{}/", user.id))
    {
        return answer(
            field_error("attachment", text("attachmentInvalid")),
            cookies,
        );
    }
    let identity = DbIdentity::authenticated(user.id.as_str());
    let reserved: Result<(), sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query("select public.reserve_submission_attempt()")
                    .execute(tx)
                    .await
                    .map(|_| ())
            })
        })
        .await;
    if let Err(error) = reserved {
        let (code, _) = database_error(&error);
        tracing::warn!(?code, "submission attempt not reserved");
        let message = if code.as_deref() == Some("P0429") {
            "rateLimited"
        } else {
            "submitFailed"
        };
        return answer(state_error(Map::new(), Some(text(message))), cookies);
    }
    // The link is checked again here: the form's preview can be skipped.
    if !input.source_url.is_empty()
        && is_supported_url(&input.source_url)
        && state.oembed.get(&input.source_url).await.is_err()
    {
        return answer(field_error("sourceUrl", text("sourceUnavailable")), cookies);
    }
    let optional = |value: &str| (!value.is_empty()).then(|| value.to_owned());
    let tags = parse_tags(&input.tags);
    let args = (
        input.name.clone(),
        optional(&input.seen_at),
        optional(&input.source_url),
        input.description.clone(),
        optional(&input.guess_reason),
        tags,
        optional(&input.attachment_path),
    );
    let submitted: Result<String, sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                let (name, seen_at, url, description, guess, tags, attachment) = args;
                sqlx::query_scalar(SUBMIT_SQL)
                    .bind(name)
                    .bind(seen_at)
                    .bind(url)
                    .bind(description)
                    .bind(guess)
                    .bind(tags)
                    .bind(attachment)
                    .fetch_one(tx)
                    .await
            })
        })
        .await;
    let state = match submitted {
        Ok(id) => json!({ "status": "success", "submissionId": id }),
        Err(error) => {
            let (code, message) = database_error(&error);
            if code.as_deref() == Some("P0429") {
                state_error(Map::new(), Some(text("rateLimited")))
            } else if message.contains("invalid_url") {
                field_error("sourceUrl", text("sourceUrlInvalid"))
            } else if message.contains("invalid_attachment_path") {
                field_error("attachment", text("attachmentInvalid"))
            } else if message.contains("login_required") {
                state_error(Map::new(), Some(text("loginRequired")))
            } else {
                tracing::warn!(?code, "meme submission failed");
                state_error(Map::new(), Some(text("submitFailed")))
            }
        }
    };
    answer(state, cookies)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entries(text: &str) -> Vec<(String, Json)> {
        Json::parse(text)
            .and_then(|json| json.as_object().map(<[_]>::to_vec))
            .unwrap()
    }

    // Expected values: createSubmitSchema(SUBMIT_COPY.ko) and parseTags under Node.
    #[test]
    fn the_form_is_read_as_the_schema_reads_it() {
        let errors = &copy::submit("ko")["errors"];
        let ok = parse(
            &entries(r#"{"name":" 우당탕 ","sourceUrl":"https://youtu.be/x","tags":"a, b"}"#),
            errors,
        )
        .unwrap();
        assert_eq!(ok.name, "우당탕");
        assert_eq!(ok.source_url, "https://youtu.be/x");
        assert_eq!(ok.attachment_path, "");
        let failed = parse(
            &entries(&format!(
                r#"{{"name":" ","sourceUrl":"http://x.y","tags":"{}"}}"#,
                "a".repeat(301)
            )),
            errors,
        )
        .unwrap_err();
        assert_eq!(failed["name"], errors["nameRequired"]);
        assert_eq!(failed["sourceUrl"], errors["sourceUrlInvalid"]);
        assert_eq!(failed["tags"], errors["tagsTooLong"]);
        // Too long and not a link: the first message is the length's.
        let long = format!("https://{}", "a".repeat(500));
        let failed = parse(
            &entries(&format!(r#"{{"name":"a","sourceUrl":"{long}"}}"#)),
            errors,
        )
        .unwrap_err();
        assert_eq!(failed["sourceUrl"], errors["sourceUrlTooLong"]);
        assert!(looks_like_https_link("https://a.b"));
        assert!(!looks_like_https_link("https://ab."));
        assert!(!looks_like_https_link("https://.b"));
        assert!(!looks_like_https_link("https://a b.c"));
        assert_eq!(
            parse_tags(" 직장인, 유행어 ,,직장인, "),
            vec!["직장인", "유행어"]
        );
        assert_eq!(parse_tags(&"x,".repeat(3)), vec!["x"]);
        assert_eq!(
            parse_tags(&(0..12).map(|n| n.to_string()).collect::<Vec<_>>().join(",")).len(),
            10
        );
        assert!(parse_tags(&"가".repeat(31)).is_empty());
    }

    #[test]
    fn only_provider_links_are_checked() {
        assert!(is_supported_url("https://www.youtube.com/watch?v=x"));
        assert!(is_supported_url("https://fb.watch/x"));
        assert!(is_supported_url("https://m.threads.com/@a"));
        assert!(!is_supported_url("https://example.com/x"));
        assert!(!is_supported_url("https://notyoutube.com/x"));
        assert!(!is_supported_url("youtube.com"));
    }
}
