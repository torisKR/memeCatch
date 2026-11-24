//! `POST /api/memes/view`: `app/api/memes/view/route.ts`. Counts one view of
//! a meme per visitor per day in Korea. The visitor is the analytics session
//! of the request, or its network address without one; the database keeps
//! only a keyed hash of that and the day (`increment_view`).

use std::sync::Arc;
use std::time::SystemTime;

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::{CONTENT_LENGTH, HeaderMap};
use axum::response::Response;

use super::growth::is_uuid;
use super::{ACCEPTED, Client, Tracking, refused};
use crate::db::{Db, DbIdentity, IdentityOptions};
use crate::routes::public::quiz;
use crate::routes::request::{self, BodyError, Json, RequestOrigin};
use crate::{AppState, fallback};

const MAX_BODY_BYTES: usize = 128;
/// `request.text()` drops a leading byte order mark before the size is
/// checked, so a body may be this much longer than the limit.
const BOM_BYTES: usize = 3;
const VIEWS_PER_MINUTE: usize = 120;
const INCREMENT_VIEW: &str =
    "select public.increment_view(p_meme_id => $1::uuid, p_session_hash => $2)";

pub async fn record(
    State(state): State<AppState>,
    tracking: Arc<Tracking>,
    request: Request,
) -> Response {
    // An Origin that is neither absent nor the site's may still be Next's
    // own, which only Next knows.
    if !request::has_ascii_target(request.uri())
        || request::request_origin(request.headers(), &tracking.site) == RequestOrigin::Other
    {
        return fallback::answer(State(state), request).await;
    }
    let (parts, body) = request.into_parts();
    let client = Client::of(&parts);
    if let Some(limited) = tracking.limited("meme-view:", &client.limit_key, VIEWS_PER_MINUTE) {
        return limited;
    }
    let meme_id = match read_meme_id(&parts.headers, body).await {
        Ok(meme_id) => meme_id,
        Err((status, error)) => return refused(status, error),
    };

    let day = quiz::kst_day_key(SystemTime::now());
    let viewer = match tracking.keys.session_id(&parts.headers) {
        Some(session_id) => format!("session:{session_id}"),
        None => format!("network:{}", client.address),
    };
    let viewer_key = tracking
        .keys
        .keyed_hash(format!("{day}\0{viewer}").as_bytes());
    match increment_view(&state.db, meme_id, viewer_key).await {
        Ok(()) => request::json(StatusCode::ACCEPTED, ACCEPTED),
        Err(error) => {
            tracing::warn!(%error, "increment_view failed");
            refused(StatusCode::SERVICE_UNAVAILABLE, "view_unavailable")
        }
    }
}

/// The checks on the body, in the order of the TypeScript: the declared
/// size, the size read, that it is JSON, and a meme id that is a UUID. `Err`
/// is the status and the `error` code to refuse with.
async fn read_meme_id(
    headers: &HeaderMap,
    body: Body,
) -> Result<String, (StatusCode, &'static str)> {
    const TOO_LARGE: (StatusCode, &str) = (StatusCode::PAYLOAD_TOO_LARGE, "payload_too_large");
    const INVALID_JSON: (StatusCode, &str) = (StatusCode::BAD_REQUEST, "invalid_json");
    if declared_length(headers).is_some_and(|length| length > MAX_BODY_BYTES as u64) {
        return Err(TOO_LARGE);
    }
    // Next reads the whole body before it measures it. Decoding never makes
    // a body shorter except for the mark, so more than this is too large.
    let text = match request::read_at_most(body, MAX_BODY_BYTES + BOM_BYTES).await {
        Ok(bytes) => request::decode_text(&bytes),
        Err(BodyError::TooLarge) => return Err(TOO_LARGE),
        Err(BodyError::Unreadable) => return Err(INVALID_JSON),
    };
    if text.len() > MAX_BODY_BYTES {
        return Err(TOO_LARGE);
    }
    let payload = Json::parse(&text).ok_or(INVALID_JSON)?;
    meme_id(&payload)
        .map(str::to_owned)
        .ok_or((StatusCode::BAD_REQUEST, "invalid_meme"))
}

/// `Number(request.headers.get("content-length"))` where it is a number.
fn declared_length(headers: &HeaderMap) -> Option<u64> {
    std::str::from_utf8(headers.get(CONTENT_LENGTH)?.as_bytes())
        .ok()?
        .parse()
        .ok()
}

/// `payload.memeId` of an object, when it is a UUID.
fn meme_id(payload: &Json) -> Option<&str> {
    request::property(payload.as_object()?, "memeId")?
        .as_str()
        .filter(|meme_id| is_uuid(meme_id))
}

/// The view is recorded as `service_role`, the only role the function
/// accepts. A second call with the same key on the same day changes nothing.
async fn increment_view(db: &Db, meme_id: String, viewer_key: String) -> Result<(), sqlx::Error> {
    db.with_identity(
        &DbIdentity::service_role(),
        IdentityOptions::default(),
        |tx| {
            Box::pin(async move {
                sqlx::query(INCREMENT_VIEW)
                    .bind(meme_id)
                    .bind(viewer_key)
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

    const MEME: &str = "11111111-1111-4111-8111-111111111111";

    #[test]
    fn meme_id_is_the_uuid_string_of_an_object() {
        let meme_id_of = |text: &str| {
            let payload = Json::parse(text).expect("valid JSON");
            meme_id(&payload).map(str::to_owned)
        };

        assert_eq!(
            meme_id_of(&format!(r#"{{"memeId":"{MEME}"}}"#)).as_deref(),
            Some(MEME)
        );
        // Other keys are ignored, and the last `memeId` counts.
        assert_eq!(
            meme_id_of(&format!(r#"{{"memeId":1,"x":[],"memeId":"{MEME}"}}"#)).as_deref(),
            Some(MEME)
        );
        for invalid in [
            format!(r#"{{"memeId":"{MEME}","memeId":null}}"#),
            format!(r#"{{"memeid":"{MEME}"}}"#),
            format!(r#"{{"memeId":" {MEME}"}}"#),
            format!(r#"{{"memeId":["{MEME}"]}}"#),
            format!(r#"["{MEME}"]"#),
            format!(r#""{MEME}""#),
            r#"{"memeId":"not-a-uuid"}"#.to_owned(),
            "{}".to_owned(),
            "null".to_owned(),
            "0".to_owned(),
        ] {
            assert_eq!(meme_id_of(&invalid), None, "{invalid}");
        }
    }

    #[test]
    fn declared_length_is_read_only_when_it_is_a_number() {
        let length = |value: &'static str| {
            let mut headers = HeaderMap::new();
            headers.insert(CONTENT_LENGTH, value.parse().unwrap());
            declared_length(&headers)
        };

        assert_eq!(length("128"), Some(128));
        assert_eq!(length("129"), Some(129));
        assert_eq!(length("abc"), None);
        assert_eq!(declared_length(&HeaderMap::new()), None);
    }
}
