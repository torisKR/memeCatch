//! `POST /api/meme-cards/claim`: `app/api/meme-cards/claim/route.ts`. Adds
//! one card to the signed-in user's collection. Claiming a card twice is not
//! an error: the row stays as it was and its first claim time is returned.

use axum::extract::{Request, State};
use axum::http::StatusCode;
use axum::http::header::HeaderName;
use axum::response::Response;
use serde::Serialize;

use super::store;
use super::{CardError, card_api_error, is_card_id, private};
use crate::auth::SessionUser;
use crate::db::Db;
use crate::routes::request::{self, BodyError, Json, RequestOrigin, SiteOrigin};
use crate::{AppState, proxy};

const MAX_BODY_BYTES: usize = 1024;
/// Row-level security refused the row, or the card or user it points at is
/// gone: `card_unavailable`, 409.
const REFUSED_CODES: [&str; 2] = ["42501", "23503"];

pub async fn claim(State(state): State<AppState>, site: SiteOrigin, request: Request) -> Response {
    if !request::has_ascii_target(request.uri()) {
        return proxy::forward(State(state), request).await;
    }
    // `hasTrustedOrigin`: with an Origin header, the site's origin or Next's
    // own (which only Next knows); without one, a same-origin fetch.
    match request::request_origin(request.headers(), &site) {
        RequestOrigin::Site => {}
        RequestOrigin::Other => return proxy::forward(State(state), request).await,
        RequestOrigin::Absent => {
            let fetch_site = HeaderName::from_static("sec-fetch-site");
            let same_origin = request::header_text(request.headers(), &fetch_site, ", ");
            if same_origin.as_deref() != Some("same-origin") {
                return error(StatusCode::FORBIDDEN, "invalid_origin");
            }
        }
    }

    let (mut parts, body) = request.into_parts();
    let text = match request::read_bounded_text(&parts.headers, body, MAX_BODY_BYTES).await {
        Ok(text) => text,
        Err(BodyError::TooLarge) => return error(StatusCode::PAYLOAD_TOO_LARGE, "body_too_large"),
        Err(BodyError::Unreadable) => return card_api_error(CardError::INVALID_INPUT),
    };
    let body = Json::parse(&text);
    let Some(card_id) = body.as_ref().and_then(claimed_card_id) else {
        return card_api_error(CardError::INVALID_INPUT);
    };
    let Some(user) = request::session_user(&state, &mut parts).await else {
        return card_api_error(CardError::SIGNED_OUT);
    };
    match claim_card(&state.db, &user, card_id).await {
        Ok(body) => private(StatusCode::OK, body),
        Err(error) => card_api_error(error),
    }
}

fn error(status: StatusCode, code: &'static str) -> Response {
    card_api_error(CardError::new(status, code))
}

/// The body must be an object with the one key `cardId` holding a card id.
fn claimed_card_id(body: &Json) -> Option<&str> {
    match body.as_object()? {
        [(key, Json::String(card_id))] if key == "cardId" && is_card_id(card_id) => Some(card_id),
        _ => None,
    }
}

/// `claimMemeCollectibleCard`.
async fn claim_card(db: &Db, user: &SessionUser, card_id: &str) -> Result<String, CardError> {
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Claimed {
        card_id: String,
        owned: bool,
        claimed_at: String,
    }

    // Eligibility is read as the anonymous visitor: a draft the caller owns
    // or operator-only content must not be claimable.
    if store::eligible_by_ids(db, vec![card_id.to_owned()])
        .await?
        .is_empty()
    {
        return Err(CardError::NOT_FOUND);
    }
    let identity = user.db_identity();
    if let Err(failure) = store::claim(db, &identity, user.id.clone(), card_id.to_owned()).await {
        let code = failure
            .as_database_error()
            .and_then(|database| database.code().map(|code| code.into_owned()));
        if code.is_some_and(|code| REFUSED_CODES.contains(&code.as_str())) {
            return Err(CardError::CONFLICT);
        }
        return Err(failure.into());
    }
    let owned = store::ownership(db, &identity, user.id.clone(), card_id.to_owned())
        .await?
        .ok_or(CardError::UNAVAILABLE)?;
    Ok(serde_json::to_string(&Claimed {
        card_id: owned.card_id,
        owned: true,
        claimed_at: owned.claimed_at,
    })
    .expect("strings"))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Expected values follow the shape check of the route under Node.
    #[test]
    fn body_must_be_an_object_with_only_a_card_id() {
        let card_id = |text: &str| {
            let body = Json::parse(text)?;
            claimed_card_id(&body).map(str::to_owned)
        };

        assert_eq!(
            card_id(r#"{"cardId":"mc-0001"}"#).as_deref(),
            Some("mc-0001")
        );
        // `Object.keys` lists a repeated key once, with its last value.
        assert_eq!(
            card_id(r#"{"cardId":"nope","cardId":"mc-1000"}"#).as_deref(),
            Some("mc-1000")
        );
        for invalid in [
            r#"{"cardId":"mc-0001","cardId":"nope"}"#,
            r#"{"cardId":"mc-0000"}"#,
            r#"{"cardId":1}"#,
            r#"{"cardId":null}"#,
            r#"{"cardId":["mc-0001"]}"#,
            r#"{"cardId":"mc-0001","extra":1}"#,
            r#"{"card_id":"mc-0001"}"#,
            r#"{}"#,
            r#"["mc-0001"]"#,
            r#""mc-0001""#,
            "null",
            "",
            "{",
        ] {
            assert_eq!(card_id(invalid), None, "{invalid}");
        }
    }
}
