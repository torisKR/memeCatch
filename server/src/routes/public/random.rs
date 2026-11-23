//! `GET /api/random-meme` (`app/api/random-meme/route.ts`) and
//! `GET /memes/random` (`app/(default)/memes/random/route.ts`).
//!
//! Both read as the anonymous visitor (`createStaticClient`), one transaction
//! per query as in the TypeScript, and both treat a failed query like "no
//! row": the plan client returns `{ data: null, error }` instead of throwing.

use axum::extract::State;
use axum::http::header::{CACHE_CONTROL, CONTENT_LANGUAGE, CONTENT_TYPE, LOCATION};
use axum::http::{HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use sqlx::PgConnection;
use url::Url;

use super::{js, unsized_body};
use crate::AppState;
use crate::db::{BoxFuture, Db, DbIdentity, IdentityOptions};

const SHORT_ID_ALPHABET: &[u8; 31] = b"abcdefghjkmnpqrstuvwxyz23456789";
const FALLBACK_PATH: &str = "/explore";
// SITE_URL in the /memes/random route file. Not the default of lib/site.ts.
const REDIRECT_DEFAULT_SITE_URL: &str = "http://localhost:3000";

const FIRST_AT_OR_AFTER: &str = "select short_id, slug from public.memes \
     where moderation_status = 'approved' and short_id >= $1 \
     order by short_id asc limit 1";
const FIRST_BEFORE: &str = "select short_id, slug from public.memes \
     where moderation_status = 'approved' and short_id < $1 \
     order by short_id asc limit 1";
const COUNT_APPROVED: &str =
    "select count(*)::int from public.memes where moderation_status = 'approved'";
// No ORDER BY, as in the TypeScript (`.range(offset, offset)`).
const APPROVED_AT_OFFSET: &str = "select short_id, slug from public.memes \
     where moderation_status = 'approved' limit 1 offset $1";

type MemeKey = (String, String);

/// `memePathFrom` in lib/labels.ts.
fn meme_path((short_id, slug): &MemeKey) -> String {
    format!("/memes/{short_id}-{}", js::encode_uri_component(slug))
}

fn random_short_id() -> String {
    (0..8)
        .map(|_| char::from(SHORT_ID_ALPHABET[rand::random_range(0..SHORT_ID_ALPHABET.len())]))
        .collect()
}

/// Runs `run` in its own anonymous transaction. `None` when it fails or
/// finds no row.
async fn as_anon<T, F>(db: &Db, run: F) -> Option<T>
where
    F: for<'c> FnOnce(&'c mut PgConnection) -> BoxFuture<'c, Result<Option<T>, sqlx::Error>> + Send,
    T: Send,
{
    db.with_identity(&DbIdentity::anon(), IdentityOptions::default(), run)
        .await
        .unwrap_or_else(|error| {
            tracing::warn!(%error, "random meme query failed");
            None
        })
}

async fn first_approved(db: &Db, sql: &'static str, pivot: String) -> Option<MemeKey> {
    as_anon(db, |tx| {
        Box::pin(async move { sqlx::query_as(sql).bind(pivot).fetch_optional(tx).await })
    })
    .await
}

#[derive(Serialize)]
struct PathBody {
    path: String,
}

/// `GET /api/random-meme`: always 200 `{"path": ...}`.
pub async fn json(State(state): State<AppState>) -> Response {
    let pivot = random_short_id();
    let mut meme = first_approved(&state.db, FIRST_AT_OR_AFTER, pivot.clone()).await;
    if meme.is_none() {
        meme = first_approved(&state.db, FIRST_BEFORE, pivot).await;
    }
    let path = meme.map_or_else(|| FALLBACK_PATH.to_owned(), |meme| meme_path(&meme));
    let body = serde_json::to_vec(&PathBody { path }).expect("a string serializes");
    (
        [
            (CONTENT_TYPE, "application/json"),
            (CACHE_CONTROL, "no-store"),
        ],
        unsized_body(body),
    )
        .into_response()
}

/// Where `/memes/random` redirects. Built once at startup.
#[derive(Clone)]
pub struct RedirectTargets {
    site_url: String,
    explore: HeaderValue,
}

impl RedirectTargets {
    /// `site_url_env` is `NEXT_PUBLIC_SITE_URL` as given, `None` when unset.
    ///
    /// `None` is returned when `<site url>/explore` is not an absolute URL.
    /// `NextResponse.redirect` throws on that, also inside the route's own
    /// `catch`, so Next answers 500 to every request; the route is then left
    /// to Next.
    pub fn new(site_url_env: Option<&str>) -> Option<Self> {
        let site_url = site_url_env.unwrap_or(REDIRECT_DEFAULT_SITE_URL).to_owned();
        let explore = location(&format!("{site_url}{FALLBACK_PATH}"))?;
        Some(Self { site_url, explore })
    }
}

/// `Location` as `NextResponse.redirect` writes it: `String(new URL(url))`,
/// the WHATWG serialization (lowercase host, default port dropped, and so on).
fn location(url: &str) -> Option<HeaderValue> {
    HeaderValue::from_str(Url::parse(url).ok()?.as_str()).ok()
}

/// `GET /memes/random`: 302 to a random approved meme, or to `/explore`.
pub async fn redirect(State(state): State<AppState>, targets: RedirectTargets) -> Response {
    let target = random_approved(&state.db)
        .await
        .and_then(|meme| location(&format!("{}{}", targets.site_url, meme_path(&meme))));
    let mut response = match target {
        Some(location) => (
            StatusCode::FOUND,
            [
                (LOCATION, location),
                (CACHE_CONTROL, HeaderValue::from_static("no-store")),
            ],
        )
            .into_response(),
        // The fallback redirect sets no Cache-Control in the TypeScript either.
        None => (StatusCode::FOUND, [(LOCATION, targets.explore)]).into_response(),
    };
    // proxy.ts runs for this path (it is not under /api) and stamps the
    // document language on whatever the route answers. The path has no locale
    // prefix, so the value is always `ko`.
    response
        .headers_mut()
        .insert(CONTENT_LANGUAGE, HeaderValue::from_static("ko"));
    *response.body_mut() = unsized_body("");
    response
}

async fn random_approved(db: &Db) -> Option<MemeKey> {
    let count: i32 = as_anon(db, |tx| {
        Box::pin(async move { sqlx::query_scalar(COUNT_APPROVED).fetch_optional(tx).await })
    })
    .await?;
    if count <= 0 {
        return None;
    }
    let offset = rand::random_range(0..count);
    // `.single()`: no row (one was deleted since the count) is "no data".
    as_anon(db, |tx| {
        Box::pin(async move {
            sqlx::query_as(APPROVED_AT_OFFSET)
                .bind(offset)
                .fetch_optional(tx)
                .await
        })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    fn target(site_url_env: Option<&str>) -> Option<String> {
        RedirectTargets::new(site_url_env)
            .map(|targets| targets.explore.to_str().unwrap().to_owned())
    }

    #[test]
    fn meme_path_percent_encodes_the_slug_only() {
        let meme = ("rk3w632x".to_owned(), "중꺾마 밈".to_owned());

        assert_eq!(
            meme_path(&meme),
            "/memes/rk3w632x-%EC%A4%91%EA%BA%BE%EB%A7%88%20%EB%B0%88"
        );
    }

    #[test]
    fn pivot_is_eight_characters_of_the_short_id_alphabet() {
        for _ in 0..200 {
            let pivot = random_short_id();
            assert_eq!(pivot.len(), 8);
            assert!(
                pivot.bytes().all(|b| SHORT_ID_ALPHABET.contains(&b)),
                "{pivot}"
            );
        }
    }

    // Expected values are what Node prints for String(new URL(input + "/explore")).
    #[test]
    fn explore_target_is_the_whatwg_serialization_of_the_site_url() {
        assert_eq!(target(None).unwrap(), "http://localhost:3000/explore");
        assert_eq!(
            target(Some("https://catchmeme.com")).unwrap(),
            "https://catchmeme.com/explore"
        );
        assert_eq!(
            target(Some("HTTPS://CatchMeme.com:443/")).unwrap(),
            "https://catchmeme.com//explore"
        );
        assert_eq!(
            target(Some("http://127.0.0.1:3001")).unwrap(),
            "http://127.0.0.1:3001/explore"
        );
    }

    #[test]
    fn meme_location_keeps_what_encode_uri_component_left_unescaped() {
        let meme = ("rk3w632x".to_owned(), "중꺾마 밈 (a)!~*'".to_owned());

        let location = location(&format!("https://catchmeme.com{}", meme_path(&meme)));

        // What Node prints for String(new URL(...)) of the same string.
        assert_eq!(
            location.unwrap(),
            "https://catchmeme.com/memes/rk3w632x-%EC%A4%91%EA%BA%BE%EB%A7%88%20%EB%B0%88%20(a)!~*'"
        );
    }

    #[test]
    fn a_site_url_next_cannot_redirect_to_leaves_the_route_to_next() {
        // `new URL("/explore")` and `new URL("catchmeme.com/explore")` throw.
        assert_eq!(target(Some("")), None);
        assert_eq!(target(Some("catchmeme.com")), None);
    }
}
