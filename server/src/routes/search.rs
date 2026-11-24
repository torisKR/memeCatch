//! `POST /api/memes/semantic-search`: `app/api/memes/semantic-search/route.ts`,
//! `searchMemeReferences` (lib/meme-reference-search.server.ts) and the
//! keyword search it falls back to, `searchMemes` (lib/queries.ts) with the
//! curated cards and the presentation merge. Route id `memes-semantic-search`.
//!
//! Registered only when the semantic path cannot run: semantic search off,
//! or no usable `MEME_EMBEDDING_URL` (`embeddingEndpoint` gives `null`, as in
//! production). Then every answer is the keyword search with reason
//! `disabled` or `model_unavailable`. With an embedding URL Next keeps the
//! route: the embedding call and `search_meme_references` are not ported.

use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::{Arc, LazyLock};

use axum::Router;
use axum::extract::{ConnectInfo, Request, State};
use axum::http::StatusCode;
use axum::http::header::{CACHE_CONTROL, RETRY_AFTER};
use axum::response::Response;
use axum::routing::post;
use serde::de::IgnoredAny;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use unicode_normalization::UnicodeNormalization;
use url::Url;

use super::Routes;
use super::public::content_depth::{self, ContentRef, DepthInput, SourceRef};
use super::public::csp_report::now_ms;
use super::public::js;
use super::public::rate_limit::{self, RateLimit, RateLimiter};
use super::request::{self, Json, SiteOrigin};
use crate::db::{DbIdentity, IdentityOptions};
use crate::{AppState, fallback};

const MAX_BODY_BYTES: usize = 2048;
const LIMIT: usize = 20;
const WINDOW_MS: i64 = 60_000;
/// `searchMemes` asks for `Math.max(limit, 50)` and keeps 50 listable rows.
const ROWS: usize = 50;
// What lib/db/execute.ts compiles for `rpc("search_memes", …).select(INDEXABLE_LIST_SELECT).in(…)`.
const SEARCH_SQL: &str = r#"WITH __q AS (SELECT r1."id", r1."short_id", r1."slug", r1."title", r1."summary", r1."category", r1."safety_level", r1."lifecycle_status", r1."media_type", r1."origin_year", r1."trend_score", r1."description", r1."origin", r1."usage_note", r1."caution", r1."usage_examples", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r2."thumbnail_url", r2."is_representative", r2."platform", r2."url", r2."content_id", r2."availability", r2."moderation_status", r2."manual_video_verified", r2."type" FROM public."meme_contents" r2 WHERE r2."meme_id" = r1."id" AND TRUE) e) AS "meme_contents", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r3."source_url", r3."hidden_from_public" FROM public."meme_sources" r3 WHERE r3."meme_id" = r1."id" AND TRUE) e) AS "meme_sources", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r4."tag_id" FROM public."meme_tags_map" r4 WHERE r4."meme_id" = r1."id" AND TRUE) e) AS "meme_tags_map", (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM (SELECT r5."market_code", r5."role", r5."review_state" FROM public."meme_market_profiles" r5 WHERE r5."meme_id" = r1."id" AND TRUE) e) AS "meme_market_profiles" FROM public."search_memes"("p_query" => $1, "p_limit" => $2) r1 WHERE r1."moderation_status"::text = ANY($3::text[])) SELECT row_to_json(__q)::text FROM __q"#;

/// `MemeReference`: what each result carries.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub(crate) struct Reference {
    pub(crate) id: String,
    short_id: String,
    slug: String,
    title: String,
    summary: String,
}

/// The `fallback(reason)` result, its keys in the TypeScript's order.
#[derive(Serialize)]
struct Keyword {
    mode: &'static str,
    reason: &'static str,
    items: Vec<Reference>,
}

/// One curated meme, from `curated.json` (`parity/curated-search-catalog.mjs`).
#[derive(Deserialize)]
struct Curated {
    #[serde(flatten)]
    reference: Reference,
    haystack: String,
    listed: bool,
    category: String,
    safety_level: Option<String>,
    origin_year: Option<i32>,
}

/// A curated card as `/explore` lists it (`curatedSearchCards`).
pub(crate) struct CuratedCard {
    pub(crate) id: String,
    pub(crate) short_id: String,
    pub(crate) slug: String,
    pub(crate) title: String,
    pub(crate) summary: String,
    pub(crate) category: String,
    pub(crate) safety_level: Option<String>,
    pub(crate) origin_year: Option<i32>,
}

static CURATED: LazyLock<Vec<Curated>> = LazyLock::new(|| {
    serde_json::from_str(include_str!("search/curated.json")).expect("curated.json")
});

/// One `search_memes` row with the signals `isIndexableMeme` reads.
#[derive(Deserialize)]
struct Row {
    #[serde(flatten)]
    reference: Reference,
    description: String,
    origin: String,
    usage_note: Option<String>,
    caution: Option<String>,
    usage_examples: Option<Value>,
    meme_sources: Vec<SourceRef>,
    meme_contents: Vec<ContentRef>,
    meme_tags_map: Vec<IgnoredAny>,
}

impl Row {
    fn is_listed(&self) -> bool {
        content_depth::is_indexable(&DepthInput {
            description: &self.description,
            origin: &self.origin,
            usage_note: self.usage_note.as_deref(),
            caution: self.caution.as_deref(),
            usage_examples: self.usage_examples.as_ref(),
            sources: &self.meme_sources,
            contents: &self.meme_contents,
            tag_count: self.meme_tags_map.len(),
        })
    }
}

/// `embeddingEndpoint(env) !== null`: whether Next would try the semantic path.
pub fn embedding_endpoint_usable(enabled: bool, url: Option<&str>) -> bool {
    let Some(url) = url.filter(|_| enabled).and_then(|url| Url::parse(url).ok()) else {
        return false;
    };
    let loopback = matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "[::1]"));
    let empty = |part: Option<&str>| part.is_none_or(str::is_empty);
    url.username().is_empty()
        && url.password().is_none()
        && empty(url.query())
        && empty(url.fragment())
        && url.path() == "/v1/embeddings"
        && (url.scheme() == "https" || (url.scheme() == "http" && loopback))
}

pub fn router(state: &AppState) -> Router<AppState> {
    let routes = Routes::new(state);
    let config = &state.config;
    let site = SiteOrigin::from_site_url(&config.site_url);
    let semantic = embedding_endpoint_usable(
        config.semantic_search_enabled,
        config.embedding_url.as_deref(),
    );
    let (Some(site), false) = (site, semantic) else {
        // Next keeps the route: the semantic path, or a site URL `new URL` refuses.
        return routes.build();
    };
    let reason = if config.semantic_search_enabled {
        "model_unavailable"
    } else {
        "disabled"
    };
    let limiter = Arc::new(RateLimiter::new(now_ms()));
    routes
        .add(
            "memes-semantic-search",
            "/api/memes/semantic-search",
            post(move |state: State<AppState>, request: Request| {
                search(state, site.clone(), limiter.clone(), reason, request)
            }),
        )
        .build()
}

fn answer(status: StatusCode, body: String) -> Response {
    let mut response = request::json(status, body);
    response
        .headers_mut()
        .insert(CACHE_CONTROL, "no-store".parse().expect("a header value"));
    response
}

fn error(status: StatusCode, code: &str) -> Response {
    answer(status, format!(r#"{{"error":"{code}"}}"#))
}

/// `schema.safeParse(...)`: the trimmed query and the limit (default 12).
fn parsed(payload: Option<&Json>) -> Option<(String, usize)> {
    let entries = payload?.as_object()?;
    let query = js::trim(request::property(entries, "query").and_then(Json::as_str)?);
    let limit = match request::property(entries, "limit") {
        None => 12,
        Some(Json::Number(n)) if n.fract() == 0.0 && (1.0..=20.0).contains(n) => *n as usize,
        Some(_) => return None,
    };
    (2..=120)
        .contains(&js::utf16_len(query))
        .then(|| (query.to_owned(), limit))
}

/// The in-memory limit: `None` when the request may go on.
fn limited(limiter: &RateLimiter, parts: &axum::http::request::Parts) -> Option<Response> {
    let peer = parts
        .extensions
        .get::<ConnectInfo<SocketAddr>>()
        .map(|ConnectInfo(address)| address.ip());
    let client = rate_limit::client_ip(&parts.headers, peer);
    let key = [b"meme-reference:", client.as_slice()].concat();
    let RateLimit::Limited { retry_after_sec } = limiter.check(key, LIMIT, WINDOW_MS, now_ms())
    else {
        return None;
    };
    let mut response = error(StatusCode::TOO_MANY_REQUESTS, "rate_limited");
    response
        .headers_mut()
        .insert(RETRY_AFTER, retry_after_sec.into());
    Some(response)
}

async fn search(
    State(state): State<AppState>,
    site: SiteOrigin,
    limiter: Arc<RateLimiter>,
    reason: &'static str,
    request: Request,
) -> Response {
    let trusted = request::trusted_origin(request.headers(), &site);
    let (true, Some(trusted)) = (request::has_ascii_target(request.uri()), trusted) else {
        return fallback::answer(State(state), request).await;
    };
    if !trusted {
        return error(StatusCode::FORBIDDEN, "invalid_origin");
    }
    let (parts, body) = request.into_parts();
    if let Some(response) = limited(&limiter, &parts) {
        return response;
    }
    let text = request::read_bounded_text(&parts.headers, body, MAX_BODY_BYTES).await;
    let payload = text.ok().and_then(|text| Json::parse(&text));
    let Some((query, limit)) = parsed(payload.as_ref()) else {
        return error(StatusCode::BAD_REQUEST, "invalid_query");
    };
    match keyword_search(&state, &query, limit).await {
        Ok(items) => {
            let body = Keyword {
                mode: "keyword",
                reason,
                items,
            };
            answer(
                StatusCode::OK,
                serde_json::to_string(&body).expect("strings serialize"),
            )
        }
        Err(failure) => {
            tracing::error!(%failure, "search_memes failed");
            error(StatusCode::SERVICE_UNAVAILABLE, "search_unavailable")
        }
    }
}

/// `curatedSearchCards(query)`: the listable curated memes whose text holds
/// the query (NFC, trimmed, lower-cased).
fn curated_cards(query: &str) -> Vec<Reference> {
    curated_matches(query)
        .map(|meme| meme.reference.clone())
        .collect()
}

fn curated_matches(query: &str) -> impl Iterator<Item = &'static Curated> {
    let normalized: String = query.nfc().collect();
    let needle = js::trim(&normalized).to_lowercase();
    CURATED
        .iter()
        .filter(move |meme| !needle.is_empty() && meme.listed && meme.haystack.contains(&needle))
}

/// `curatedSearchCards(query)` with what a card shows.
pub(crate) fn curated_search_cards(query: &str) -> Vec<CuratedCard> {
    curated_matches(query)
        .map(|meme| CuratedCard {
            id: meme.reference.id.clone(),
            short_id: meme.reference.short_id.clone(),
            slug: meme.reference.slug.clone(),
            title: meme.reference.title.clone(),
            summary: meme.reference.summary.clone(),
            category: meme.category.clone(),
            safety_level: meme.safety_level.clone(),
            origin_year: meme.origin_year,
        })
        .collect()
}

/// The `search_memes` rows as `anon`, listable ones, at most 50.
async fn rows(state: &AppState, query: &str) -> Result<Vec<Reference>, sqlx::Error> {
    let query = query.to_owned();
    let rows: Vec<String> = state
        .db
        .with_identity(&DbIdentity::anon(), IdentityOptions::default(), |tx| {
            Box::pin(async move {
                sqlx::query_scalar(SEARCH_SQL)
                    .persistent(false)
                    .bind(query)
                    .bind(ROWS as i32)
                    .bind(vec!["approved".to_owned(), "limited".to_owned()])
                    .fetch_all(tx)
                    .await
            })
        })
        .await?;
    let rows: Vec<Row> = rows
        .iter()
        .map(|row| serde_json::from_str(row))
        .collect::<Result<_, _>>()
        .map_err(|error| sqlx::Error::Decode(Box::new(error)))?;
    Ok(rows
        .into_iter()
        .filter(Row::is_listed)
        .take(ROWS)
        .map(|row| row.reference)
        .collect())
}

/// `searchMemes(q, limit)`, then `reference` of each item.
pub(crate) async fn keyword_search(
    state: &AppState,
    query: &str,
    limit: usize,
) -> Result<Vec<Reference>, sqlx::Error> {
    let query = js::trim(query);
    let candidates: Vec<Reference> = curated_cards(query)
        .into_iter()
        .chain(rows(state, query).await?)
        .collect();
    let mut end = limit;
    let mut merged = merge(&candidates[..end.min(candidates.len())]);
    while merged.len() < limit && end < candidates.len() {
        end += limit - merged.len();
        merged = merge(&candidates[..end.min(candidates.len())]);
    }
    Ok(merged)
}

/// `CURATED_CATALOG_EQUIVALENTS` of lib/search-presentation.ts.
const EQUIVALENTS: [(&str, &str); 1] = [("oyj2021k", "6hgbgvxs")];

fn is_catalog_equivalent(short_id: &str) -> bool {
    EQUIVALENTS.iter().any(|(_, catalog)| *catalog == short_id)
}

/// `searchPresentationKey`.
pub(crate) fn presentation_key(short_id: &str) -> String {
    let mapped = EQUIVALENTS
        .iter()
        .find(|(curated, _)| *curated == short_id)
        .map(|(_, catalog)| *catalog);
    match mapped.or_else(|| is_catalog_equivalent(short_id).then_some(short_id)) {
        Some(catalog) => format!("catalog:{catalog}"),
        None => format!("short:{short_id}"),
    }
}

/// `preference`: the catalog equivalent, then a catalog row, then curated.
pub(crate) fn preference(id: &str, short_id: &str) -> u8 {
    if is_catalog_equivalent(short_id) {
        2
    } else if id.starts_with("curated-") {
        0
    } else {
        1
    }
}

/// `mergeSearchPresentationItems`: one item per key, the first of the most
/// preferred, at its own place. `ident` gives an item's id and short id.
pub(crate) fn merge_presentation<T: Clone>(
    items: &[T],
    ident: impl Fn(&T) -> (&str, &str),
) -> Vec<T> {
    let keys: Vec<String> = items
        .iter()
        .map(|item| presentation_key(ident(item).1))
        .collect();
    let rank = |item: &T| {
        let (id, short_id) = ident(item);
        preference(id, short_id)
    };
    let winner = |key: &str| {
        let mut best: Option<usize> = None;
        for (index, item) in items.iter().enumerate() {
            let better = best.is_none_or(|best| rank(item) > rank(&items[best]));
            if keys[index] == key && better {
                best = Some(index);
            }
        }
        best
    };
    let mut emitted = HashSet::new();
    items
        .iter()
        .enumerate()
        .filter(|(index, _)| {
            winner(&keys[*index]) == Some(*index) && emitted.insert(keys[*index].clone())
        })
        .map(|(_, item)| item.clone())
        .collect()
}

fn merge(items: &[Reference]) -> Vec<Reference> {
    merge_presentation(items, |item| (item.id.as_str(), item.short_id.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, short_id: &str) -> Reference {
        Reference {
            id: id.to_owned(),
            short_id: short_id.to_owned(),
            slug: String::new(),
            title: String::new(),
            summary: String::new(),
        }
    }

    // Each verdict is what embeddingEndpoint of lib/meme-vector-lookup.server.ts gives.
    #[test]
    fn only_an_https_or_loopback_embeddings_url_is_usable() {
        let usable = |url| embedding_endpoint_usable(true, Some(url));
        assert!(usable("https://embed.example/v1/embeddings"));
        assert!(usable("http://127.0.0.1:3000/v1/embeddings"));
        assert!(usable("http://localhost/v1/embeddings?"));
        for refused in [
            "http://embed.example/v1/embeddings",
            "https://embed.example/v1/embeddings/",
            "https://u:p@embed.example/v1/embeddings",
            "https://embed.example/v1/embeddings?x=1",
            "https://embed.example/v1/embeddings#x",
            "not a url",
        ] {
            assert!(!usable(refused), "{refused}");
        }
        assert!(!embedding_endpoint_usable(
            false,
            Some("https://e.example/v1/embeddings")
        ));
        assert!(!embedding_endpoint_usable(true, None));
    }

    #[test]
    fn the_merge_keeps_one_item_per_key_preferring_the_catalog_equivalent() {
        let merged = merge(&[
            item("curated-a", "oyj2021k"),
            item("row-1", "abc"),
            item("row-2", "6hgbgvxs"),
            item("row-3", "abc"),
        ]);
        let ids: Vec<&str> = merged.iter().map(|item| item.id.as_str()).collect();
        assert_eq!(ids, ["row-1", "row-2"]);
    }

    #[test]
    fn curated_cards_match_the_query_in_their_text_when_listed() {
        let found: Vec<String> = curated_cards("중꺾마")
            .into_iter()
            .map(|item| item.short_id)
            .collect();
        assert!(found.contains(&"jkm2022k".to_owned()), "{found:?}");
        assert!(curated_cards("  ").is_empty());
        assert!(CURATED.iter().any(|meme| !meme.listed));
    }
}

#[cfg(test)]
mod listing_tests {
    use super::*;

    #[test]
    fn a_curated_meme_that_is_not_listable_is_never_a_card() {
        for meme in CURATED.iter().filter(|meme| !meme.listed) {
            let found = curated_cards(&meme.reference.slug);
            assert!(
                found.iter().all(|card| card.id != meme.reference.id),
                "{}",
                meme.reference.id
            );
        }
    }
}
