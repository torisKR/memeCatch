//! `GET /api/media/{...path}` (`media/objects.rs`, route id `media-object`) and
//! `GET /api/media/signed`, same contract as `app/api/media/signed/route.ts`:
//! serves the object a signed URL names (`Storage::signed_object_url`).
//!
//! An object that is not in storage is a 404.

mod objects;

use axum::Router;
use axum::extract::{Query, Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, CONTENT_TYPE, HeaderValue};
use axum::response::{IntoResponse, Response};
use axum::routing::get;

use super::Routes;
use crate::AppState;

pub fn router(state: &AppState) -> Router<AppState> {
    Routes::new(state)
        .add("media-signed", "/api/media/signed", get(signed))
        .add("media-object", "/api/media/{*path}", get(objects::object))
        .build()
}

async fn signed(State(state): State<AppState>, request: Request) -> Response {
    let params = Query::<Vec<(String, String)>>::try_from_uri(request.uri())
        .map(|Query(params)| params)
        .unwrap_or_default();
    // `URLSearchParams.get`: the first value of that name, or "".
    let param = |name: &str| {
        params
            .iter()
            .find(|(key, _)| key == name)
            .map_or("", |(_, value)| value.as_str())
    };
    let key = param("key");
    if key.is_empty()
        || !state
            .storage
            .verify_signed_object(key, param("exp"), param("sig"))
    {
        return json(StatusCode::UNAUTHORIZED, r#"{"message":"expired"}"#);
    }
    // Streamed: a render video is not held in memory.
    match state.storage.open_signed_object(key).await {
        Ok(Some(object)) => match HeaderValue::from_str(&object.content_type) {
            Ok(content_type) => (
                [
                    (CONTENT_TYPE, content_type),
                    (
                        CACHE_CONTROL,
                        HeaderValue::from_static("private, max-age=60"),
                    ),
                ],
                object.body,
            )
                .into_response(),
            Err(_) => json(StatusCode::BAD_REQUEST, r#"{"message":"unreadable"}"#),
        },
        Ok(None) => json(StatusCode::NOT_FOUND, r#"{"message":"missing"}"#),
        Err(error) => {
            tracing::warn!(%error, "signed object could not be read");
            json(StatusCode::BAD_REQUEST, r#"{"message":"unreadable"}"#)
        }
    }
}

// `NextResponse.json` sends exactly this content type.
fn json(status: StatusCode, body: &'static str) -> Response {
    (status, [(CONTENT_TYPE, "application/json")], body).into_response()
}
