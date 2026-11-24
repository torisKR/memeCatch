//! `scheduleIndexNowForMeme` of lib/indexnow.server.ts (protocol helpers of
//! lib/indexnow.ts): after an admin action changed a meme, its public URLs
//! go to the shared IndexNow endpoint, once the answer is on its way. Only
//! in production on the apex host, unless `INDEXNOW_DISABLED=1`; never
//! awaited, and a failure is only logged with counts and status codes.
//!
//! The parity run points `AXUM_TEST_INDEXNOW_ORIGIN` at a loopback stub,
//! which also turns the submission on whatever the site address is.

use std::time::Duration;

use axum::http::HeaderValue;
use axum::http::header::CONTENT_TYPE;
use serde_json::Value;
use sqlx::Row;
use sqlx::postgres::PgRow;

use crate::AppState;
use crate::auth::SessionUser;
use crate::pages::content_depth;
use crate::routes::admin::translations::{is_locale, same_instant};
use crate::routes::public::{js, labels};

/// Public by design: engines fetch `{ORIGIN}/{KEY}.txt` to check it.
pub const KEY: &str = "ead23314e11dd6f3fcad6b6566a1b881";
pub const HOST: &str = "catchmeme.com";
pub const ORIGIN: &str = "https://catchmeme.com";
const ENDPOINT: &str = "https://api.indexnow.org/indexnow";
const ENDPOINT_PATH: &str = "/indexnow";
const MAX_URLS: usize = 10_000;
const TIMEOUT: Duration = Duration::from_secs(10);

/// `indexNowEnabled()`, or the parity stub.
pub fn enabled(state: &AppState) -> bool {
    let config = &state.config;
    if config.indexnow_test_origin.is_some() {
        return true;
    }
    !config.indexnow_disabled
        && config.node_env_production
        && labels::site_url(&config.site_url) == ORIGIN
}

/// The meme as `INDEXNOW_MEME_SELECT` reads it, after the action.
const MEME: &str = "select m.short_id, m.slug, m.moderation_status::text as status, to_json(m.updated_at) #>> '{}' as updated_at, \
     m.description, m.origin, m.usage_note, m.caution, m.usage_examples::text as usage_examples, \
     (select coalesce(json_agg(json_build_object('source_url', s.source_url, 'hidden_from_public', s.hidden_from_public)), '[]'::json)::text \
        from public.meme_sources s where s.meme_id = m.id) as sources, \
     (select coalesce(json_agg(json_build_object('availability', c.availability, 'moderation_status', c.moderation_status)), '[]'::json)::text \
        from public.meme_contents c where c.meme_id = m.id) as contents, \
     (select count(*) from public.meme_tags_map g where g.meme_id = m.id) as tag_count, \
     (select coalesce(json_agg(json_build_object('locale', t.locale, 'status', t.status, 'localized_slug', t.localized_slug, 'title', t.title, \
        'summary', t.summary, 'description', t.description, 'origin', t.origin, 'source_updated_at', to_json(t.source_updated_at) #>> '{}')), '[]'::json)::text \
        from public.meme_translations t where t.meme_id = m.id) as translations \
     from public.memes m where m.id = $1::uuid";

/// `scheduleIndexNowForMeme(db, memeId)`: reads the meme as the operator
/// and submits its URLs in a task of its own.
pub fn schedule(state: &AppState, actor: &SessionUser, meme_id: &str) {
    if meme_id.is_empty() || !enabled(state) {
        return;
    }
    let (state, identity, meme_id) = (state.clone(), actor.db_identity(), meme_id.to_owned());
    tokio::spawn(async move {
        let row = state
            .db
            .with_identity(&identity, crate::db::IdentityOptions::default(), |tx| {
                Box::pin(async move { sqlx::query(MEME).bind(meme_id).fetch_optional(tx).await })
            })
            .await;
        match row {
            Ok(Some(row)) => match urls_for_meme(&row) {
                Ok(urls) => submit(&state, &urls).await,
                Err(error) => tracing::warn!(event = "indexnow_submit_failed", %error),
            },
            Ok(None) => {}
            Err(error) => tracing::warn!(event = "indexnow_submit_failed", %error),
        }
    });
}

/// `indexNowUrlsForMeme`: the Korean page unless it is public and thin, and
/// while public the reviewed, current translations the proxy serves.
fn urls_for_meme(row: &PgRow) -> Result<Vec<String>, sqlx::Error> {
    let short_id: String = row.try_get("short_id")?;
    let slug: String = row.try_get("slug")?;
    if short_id.is_empty() || slug.is_empty() {
        return Ok(Vec::new());
    }
    let status: Option<String> = row.try_get("status")?;
    let updated_at: String = row.try_get("updated_at")?;
    let public = matches!(status.as_deref(), Some("approved" | "limited"));
    let indexable = content_depth::row_depth(row)?.is_indexable();
    let mut urls = Vec::new();
    if !public || indexable {
        urls.push(format!("{ORIGIN}{}", labels::meme_path(&short_id, &slug)));
    }
    if !public {
        return Ok(urls);
    }
    let translations: Value = serde_json::from_str(row.try_get("translations")?)
        .map_err(|error| sqlx::Error::Decode(Box::new(error)))?;
    for translation in translations.as_array().into_iter().flatten() {
        let text = |key: &str| {
            translation
                .get(key)
                .and_then(Value::as_str)
                .unwrap_or_default()
        };
        let locale = text("locale");
        let filled = ["title", "summary", "description", "origin"]
            .iter()
            .all(|key| !js::trim(text(key)).is_empty());
        // `isIndexableLocalizedDocument`.
        if !is_locale(locale)
            || text("status") != "reviewed"
            || !same_instant(text("source_updated_at"), &updated_at)
            || !filled
            || !indexable
        {
            continue;
        }
        let localized = js::trim(text("localized_slug"));
        let slug = if localized.is_empty() {
            slug.as_str()
        } else {
            localized
        };
        urls.push(format!(
            "{ORIGIN}/{locale}{}",
            labels::meme_path(&short_id, slug)
        ));
    }
    Ok(urls)
}

/// `indexNowUrls`: absolute https URLs on the apex host, without a fragment,
/// each once.
fn kept(urls: &[String]) -> Vec<String> {
    let mut kept: Vec<String> = Vec::new();
    for raw in urls {
        let Ok(mut url) = url::Url::parse(js::trim(raw)) else {
            continue;
        };
        if url.scheme() != "https"
            || url.host_str() != Some(HOST)
            || url.port().is_some()
            || !url.username().is_empty()
            || url.password().is_some()
        {
            continue;
        }
        url.set_fragment(None);
        let url = url.to_string();
        if !kept.contains(&url) {
            kept.push(url);
        }
    }
    kept
}

/// `indexNowPayloads` as `JSON.stringify` writes each one.
fn payloads(urls: &[String]) -> Vec<(usize, String)> {
    kept(urls)
        .chunks(MAX_URLS)
        .map(|chunk| {
            let body = format!(
                r#"{{"host":{},"key":{},"keyLocation":{},"urlList":{}}}"#,
                Value::from(HOST),
                Value::from(KEY),
                Value::from(format!("{ORIGIN}/{KEY}.txt")),
                Value::from(chunk.to_vec())
            );
            (chunk.len(), body)
        })
        .collect()
}

/// `submitIndexNow`: one POST per payload; 200 and 202 are success.
async fn submit(state: &AppState, urls: &[String]) {
    let endpoint = match &state.config.indexnow_test_origin {
        Some(origin) => format!("{origin}{ENDPOINT_PATH}"),
        None => ENDPOINT.to_owned(),
    };
    let Ok(endpoint) = url::Url::parse(&endpoint) else {
        return;
    };
    let headers = [(
        CONTENT_TYPE,
        HeaderValue::from_static("application/json; charset=utf-8"),
    )];
    let mut failed: Vec<Option<u16>> = Vec::new();
    for (_, body) in payloads(urls) {
        let status = state
            .outbound
            .post(&endpoint, &headers, body, TIMEOUT)
            .await;
        match status {
            Ok(status) if status.as_u16() == 200 || status.as_u16() == 202 => {}
            Ok(status) => failed.push(Some(status.as_u16())),
            Err(_) => failed.push(None),
        }
    }
    if !failed.is_empty() {
        tracing::warn!(event = "indexnow_submit_failed", batches = failed.len(), statuses = ?failed);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_apex_https_urls_are_kept_once_without_a_fragment() {
        let urls = [
            "https://catchmeme.com/memes/a-b#x",
            " https://catchmeme.com/memes/a-b ",
            "https://www.catchmeme.com/memes/c",
            "http://catchmeme.com/memes/d",
            "https://catchmeme.com:8443/memes/e",
            "not a url",
            "https://catchmeme.com/en/memes/a-%ED%95%9C",
        ]
        .map(str::to_owned);
        assert_eq!(
            kept(&urls),
            [
                "https://catchmeme.com/memes/a-b",
                "https://catchmeme.com/en/memes/a-%ED%95%9C"
            ]
        );
    }

    #[test]
    fn a_payload_is_the_typescripts_json() {
        let payload = payloads(&["https://catchmeme.com/memes/a-b".to_owned()]);
        assert_eq!(
            payload,
            [(
                1,
                r#"{"host":"catchmeme.com","key":"ead23314e11dd6f3fcad6b6566a1b881","keyLocation":"https://catchmeme.com/ead23314e11dd6f3fcad6b6566a1b881.txt","urlList":["https://catchmeme.com/memes/a-b"]}"#
                    .to_owned()
            )]
        );
        assert!(payloads(&[]).is_empty());
    }
}
