//! `GET /memes/{key}/export` (`app/(default)/memes/[key]/export/route.ts`),
//! route id `meme-export`: a signed-in user's card of a meme as a PNG.
//!
//! 1. `?locale=` that is not a content locale: 400 `invalid_locale`;
//! 2. no session: 401 `signed_out`;
//! 3. the quota `reserve_meme_export()` as the user (30 an hour): `P0429`
//!    is 429 `rate_limited`, any other error 503 `quota_unavailable`;
//! 4. the meme by its short id (approved or limited, as the user reads it):
//!    404 `not_found`; with `?locale=` its reviewed, current translation
//!    with every required field, else 404 `localized_translation_unavailable`;
//! 5. the card (`og::export_card`), `?template=` and `?format=` read as the
//!    TypeScript reads them, downloaded as `memecatch-<id>-<template>-<format>.png`.
//!
//! Until D1 restored the function and D2-10 drew the card here, every
//! signed-in request was 503 (PLAN.md R10-B1). `proxy.ts` sets
//! `Content-Language` from `?locale=`.

use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::header::{
    CACHE_CONTROL, CONTENT_DISPOSITION, CONTENT_LANGUAGE, CONTENT_TYPE, VARY,
};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};

use super::content::short_id_from_param;
use crate::AppState;
use crate::auth::resolve_session;
use crate::db::{DbIdentity, IdentityOptions};
use crate::og::Renderer;
use crate::og::export_card::{ExportCard, Format, Template};
use crate::pages::retired::content_language;
use crate::routes::public::js;

const SEO_LOCALES: [&str; 4] = ["en", "ja", "zh", "zh-tw"];

/// The meme as the route reads it: id, title, summary, safety, lifecycle.
const MEME_SQL: &str = "select id::text, title, summary, safety_level::text, lifecycle_status::text \
                          from public.memes where short_id = $1 \
                           and moderation_status::text = any(array['approved', 'limited']) limit 2";

/// The reviewed translation and whether it is of the meme's current
/// revision (`isTranslationCurrent`, to the millisecond as JavaScript reads
/// both dates).
const TRANSLATION_SQL: &str = "select t.title, t.summary, t.description, t.origin, \
                                 date_trunc('milliseconds', t.source_updated_at) = date_trunc('milliseconds', m.updated_at) \
                                 from public.meme_translations t join public.memes m on m.id = t.meme_id \
                                where t.meme_id = $1::uuid and t.locale = $2 and t.status = 'reviewed' limit 2";

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

/// `req.nextUrl.searchParams.get(name)`.
fn param(query: Option<&str>, name: &str) -> Option<String> {
    url::form_urlencoded::parse(query?.as_bytes())
        .find(|(key, _)| key == name)
        .map(|(_, value)| value.into_owned())
}

/// `requested_locale` of the address.
fn requested_locale(query: Option<&str>) -> Option<String> {
    param(query, "locale")
}

type MemeRow = (String, String, String, Option<String>, Option<String>);
type TranslationRow = (String, String, String, String, Option<bool>);

pub async fn export(state: State<AppState>, renderer: Renderer, request: Request) -> Response {
    let query = request.uri().query().map(str::to_owned);
    let locale = requested_locale(query.as_deref());
    if locale.as_deref().is_some_and(|l| !SEO_LOCALES.contains(&l)) {
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
    let reserved: Result<(), sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query("select public.reserve_meme_export()")
                    .execute(tx)
                    .await
                    .map(|_| ())
            })
        })
        .await;
    if let Err(failure) = reserved {
        let code = failure
            .as_database_error()
            .and_then(|e| e.code().map(|c| c.into_owned()));
        return if code.as_deref() == Some("P0429") {
            error(&request, StatusCode::TOO_MANY_REQUESTS, "rate_limited")
        } else {
            tracing::warn!(%failure, "meme export quota failed");
            error(
                &request,
                StatusCode::SERVICE_UNAVAILABLE,
                "quota_unavailable",
            )
        };
    }
    let template = Template::parse(param(query.as_deref(), "template").as_deref());
    let format = Format::parse(param(query.as_deref(), "format").as_deref());
    let key = request
        .uri()
        .path()
        .strip_prefix("/memes/")
        .and_then(|rest| rest.strip_suffix("/export"))
        .unwrap_or_default();
    let short_id = short_id_from_param(key);

    let found: Result<Vec<MemeRow>, sqlx::Error> = state
        .db
        .with_identity(&identity, IdentityOptions::default(), {
            let short_id = short_id.clone();
            |tx| {
                Box::pin(async move { sqlx::query_as(MEME_SQL).bind(short_id).fetch_all(tx).await })
            }
        })
        .await;
    // `.maybeSingle()`: more than one row is an error.
    let meme = match found.as_deref() {
        Ok([meme]) => meme.clone(),
        Ok([]) => return error(&request, StatusCode::NOT_FOUND, "not_found"),
        _ => {
            return error(
                &request,
                StatusCode::SERVICE_UNAVAILABLE,
                "meme_unavailable",
            );
        }
    };
    let (id, mut title, mut summary, safety, lifecycle) = meme;
    if let Some(locale) = &locale {
        let (id, locale) = (id.clone(), locale.clone());
        let found: Result<Vec<TranslationRow>, sqlx::Error> = state
            .db
            .with_identity(&identity, IdentityOptions::default(), |tx| {
                Box::pin(async move {
                    sqlx::query_as(TRANSLATION_SQL)
                        .bind(id)
                        .bind(locale)
                        .fetch_all(tx)
                        .await
                })
            })
            .await;
        let translation = match found.as_deref() {
            Ok([]) => None,
            Ok([row]) => Some(row.clone()),
            _ => {
                return error(
                    &request,
                    StatusCode::SERVICE_UNAVAILABLE,
                    "translation_unavailable",
                );
            }
        };
        let usable = translation.filter(|(t, s, d, o, current)| {
            *current == Some(true) && [t, s, d, o].iter().all(|value| !js::trim(value).is_empty())
        });
        let Some((t, s, ..)) = usable else {
            return error(
                &request,
                StatusCode::NOT_FOUND,
                "localized_translation_unavailable",
            );
        };
        (title, summary) = (t, s);
    }
    let card = ExportCard {
        title,
        summary,
        safety: safety.unwrap_or_default(),
        lifecycle: lifecycle.unwrap_or_default(),
        locale: locale.clone().unwrap_or_else(|| "ko".to_owned()),
        template,
        format,
    };
    let Some(Ok(png)) = renderer.export(card).await else {
        return error(&request, StatusCode::SERVICE_UNAVAILABLE, "render_failed");
    };
    let filename = format!(
        "memecatch-{short_id}-{}-{}.png",
        template.name(),
        format.name()
    );
    let mut response = Response::new(Body::from(png));
    let headers = response.headers_mut();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("image/png"));
    if let Ok(value) = HeaderValue::from_str(&format!("attachment; filename=\"{filename}\"")) {
        headers.insert(CONTENT_DISPOSITION, value);
    }
    headers.insert(CACHE_CONTROL, HeaderValue::from_static("private, no-store"));
    let language = locale.as_deref().unwrap_or("ko");
    if let Ok(value) = HeaderValue::from_str(language) {
        headers.insert(CONTENT_LANGUAGE, value);
    }
    headers.insert(VARY, HeaderValue::from_static("Cookie"));
    headers.insert(
        "x-content-type-options",
        HeaderValue::from_static("nosniff"),
    );
    response
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
