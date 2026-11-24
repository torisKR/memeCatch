//! `GET /memes/{key}/export` (`app/(default)/memes/[key]/export/route.ts`),
//! route id `meme-export`: what it answers before it draws a card.
//!
//! 1. `?locale=` that is not a content locale: 400 `invalid_locale`;
//! 2. no session: 401 `signed_out`;
//! 3. the quota `rpc("reserve_meme_export")`. No migration defines that
//!    function, so the plan executor answers `function not found` (42883)
//!    and the route 503 `quota_unavailable`, for every signed-in request.
//!    The card is never drawn.
//!
//! Ported as it is (a TypeScript bug, R10's list). Should the function
//! appear, this hands the request to Next before calling it, so the quota
//! is reserved once and the card is Next's. `proxy.ts` sets
//! `Content-Language` from `?locale=`.

use axum::extract::{Request, State};
use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

use crate::auth::resolve_session;
use crate::db::{DbIdentity, IdentityOptions};
use crate::pages::retired::content_language;
use crate::{AppState, proxy};

const SEO_LOCALES: [&str; 4] = ["en", "ja", "zh", "zh-tw"];
const FUNCTION: &str = "reserve_meme_export";
/// `loadFunctions(name)`: whether a `public` function has the name.
const FUNCTION_EXISTS: &str = "select exists (select 1 from pg_catalog.pg_proc p \
                               join pg_catalog.pg_namespace n on n.oid = p.pronamespace \
                               where n.nspname = 'public' and p.proname = $1)";

/// `errorResponse(error, status)`.
fn error(request: &Request, status: StatusCode, error: &str) -> Response {
    let language = content_language(request.uri().path(), request.uri().query());
    let mut response = (
        status,
        [
            (CONTENT_TYPE, "application/json"),
            (CACHE_CONTROL, "private, no-store"),
        ],
        [("x-content-type-options", "nosniff")],
        format!(r#"{{"error":"{error}"}}"#),
    )
        .into_response();
    response
        .headers_mut()
        .insert(CONTENT_LANGUAGE, HeaderValue::from_static(language));
    response
}

/// `req.nextUrl.searchParams.get("locale")`.
fn requested_locale(query: Option<&str>) -> Option<String> {
    url::form_urlencoded::parse(query?.as_bytes())
        .find(|(name, _)| name == "locale")
        .map(|(_, value)| value.into_owned())
}

pub async fn export(state: State<AppState>, request: Request) -> Response {
    let locale = requested_locale(request.uri().query());
    if locale.is_some_and(|l| !SEO_LOCALES.contains(&l.as_str())) {
        return error(&request, StatusCode::BAD_REQUEST, "invalid_locale");
    }
    // `createClient()` treats a failed session lookup as signed out.
    let user = resolve_session(&state, request.headers())
        .await
        .ok()
        .flatten();
    let Some(user) = user else {
        return error(&request, StatusCode::UNAUTHORIZED, "signed_out");
    };
    let identity = DbIdentity::authenticated(user.id);
    let exists: Result<bool, sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(FUNCTION_EXISTS)
                    .persistent(false)
                    .bind(FUNCTION)
                    .fetch_one(tx)
                    .await
            })
        })
        .await;
    match exists {
        // The quota can be reserved: the card is Next's to draw.
        Ok(true) => proxy::forward(state, request).await,
        // `function not found`, or the lookup failed: either is an error
        // that is not `P0429`.
        Ok(false) | Err(_) => error(
            &request,
            StatusCode::SERVICE_UNAVAILABLE,
            "quota_unavailable",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_locale_is_the_first_one_decoded_as_url_search_params_do() {
        assert_eq!(
            requested_locale(Some("a=1&locale=zh-tw&locale=en")).as_deref(),
            Some("zh-tw")
        );
        assert_eq!(requested_locale(Some("locale=")).as_deref(), Some(""));
        assert_eq!(requested_locale(Some("locale=e%6E")).as_deref(), Some("en"));
        assert_eq!(requested_locale(None), None);
    }
}
