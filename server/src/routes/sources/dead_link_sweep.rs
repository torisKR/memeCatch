//! Walks the public video links in the catalog, including links without a
//! `media_sources` row. Only the daily sweep's own observations count here.

use std::collections::BTreeMap;
use std::time::Duration;

use axum::Json;
use axum::extract::State;
use axum::http::{StatusCode, header::CACHE_CONTROL};
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgConnection;
use tokio::sync::Mutex;
use tokio::time::{Instant, sleep, timeout_at};

use super::db::{self, bind};
use super::refresh::{iso_at, now_ms};
use super::url::{Platform, normalize_source_url};
use super::youtube;
use crate::AppState;
use crate::auth::CronAuthorized;
use crate::db::{DbIdentity, IdentityOptions};
use crate::oembed::target::is_youtube_id;

// Compose runs one app process. A manual call cannot overlap the scheduled run.
static SWEEP: Mutex<()> = Mutex::const_new(());
const SCAN_BUDGET: Duration = Duration::from_secs(20 * 60 - 20);
const REQUEST_PAUSE: Duration = Duration::from_millis(200);
const YOUTUBE_BATCH: usize = 50;
const DEAD_LIMIT: usize = 50;
const DB_TIMEOUT_MS: u32 = 5_000;
const PLATFORMS: [&str; 7] = [
    "YouTube",
    "YouTube Shorts",
    "Instagram",
    "X",
    "TikTok",
    "MemeCatch",
    "other",
];

#[derive(Deserialize, Serialize)]
struct Link {
    id: String,
    platform: Option<String>,
    content_id: Option<String>,
    url: Option<String>,
}

impl Link {
    fn platform(&self) -> &'static str {
        PLATFORMS
            .into_iter()
            .find(|platform| Some(*platform) == self.platform.as_deref())
            .unwrap_or("other")
    }

    fn identity(&self, platform: Platform) -> Option<String> {
        let Some(url) = self.url.as_deref().filter(|url| !url.is_empty()) else {
            return self
                .content_id
                .clone()
                .filter(|id| platform.is_youtube() && is_youtube_id(id));
        };
        let link = normalize_source_url(url)?;
        let same_provider =
            link.platform == platform || (platform.is_youtube() && link.platform.is_youtube());
        let same_id = self
            .content_id
            .as_deref()
            .filter(|id| !id.is_empty())
            .is_none_or(|id| id == link.external_id);
        (same_provider && same_id).then(|| {
            if platform.is_youtube() {
                link.external_id
            } else {
                link.canonical_url
            }
        })
    }
}

#[derive(Default, Serialize)]
struct Counts {
    /// Rows with a conclusive provider answer. Errors never dilute the breaker.
    checked: usize,
    dead: usize,
    region_blocked: usize,
    skipped: usize,
    errors: usize,
    dead_candidates: usize,
    circuit_breaker: bool,
    #[serde(skip)]
    pending: Vec<Link>,
}

impl Counts {
    fn gone(&mut self, link: Link) {
        self.dead_candidates += 1;
        if self.dead_candidates <= DEAD_LIMIT {
            self.pending.push(link);
        } else {
            self.pending.clear();
        }
    }
}

#[derive(Deserialize, Serialize)]
struct CommunityOriginLink {
    id: String,
    platform: String,
    url: String,
}

impl CommunityOriginLink {
    fn identity(&self, platform: Platform) -> Option<String> {
        let link = normalize_source_url(&self.url)?;
        let same_provider =
            link.platform == platform || (platform.is_youtube() && link.platform.is_youtube());
        same_provider.then(|| {
            if platform.is_youtube() {
                link.external_id
            } else {
                link.canonical_url
            }
        })
    }
}

#[derive(Default, Serialize)]
struct CommunityCounts {
    checked: usize,
    live: usize,
    dead: usize,
    region_blocked: usize,
    skipped: usize,
    errors: usize,
    dead_candidates: usize,
    circuit_breaker: bool,
    #[serde(skip)]
    pending_live: Vec<CommunityOriginLink>,
    #[serde(skip)]
    pending_dead: Vec<CommunityOriginLink>,
    #[serde(skip)]
    pending_blocked: Vec<CommunityOriginLink>,
}

impl CommunityCounts {
    fn gone(&mut self, link: CommunityOriginLink) {
        self.dead_candidates += 1;
        if self.dead_candidates <= DEAD_LIMIT {
            self.pending_dead.push(link);
        } else {
            self.pending_dead.clear();
        }
    }
}

type Platforms = BTreeMap<&'static str, Counts>;

pub async fn run(_: CronAuthorized, State(state): State<AppState>) -> Response {
    let Ok(_guard) = SWEEP.try_lock() else {
        return StatusCode::CONFLICT.into_response();
    };
    let started = iso_at(now_ms());
    let deadline = Instant::now() + SCAN_BUDGET;
    let mut platforms: Platforms = PLATFORMS
        .into_iter()
        .map(|p| (p, Counts::default()))
        .collect();
    let scan = scan(&state, &mut platforms, deadline).await;
    if let Err(error) = &scan {
        tracing::error!(%error, "dead link sweep scan failed");
    }
    let mut community = CommunityCounts::default();
    let community_scan = if scan == Ok(true) {
        let res = scan_community_origins(&state, &mut community, deadline).await;
        if let Err(error) = &res {
            tracing::error!(%error, "dead link sweep community scan failed");
        }
        res
    } else {
        Ok(false)
    };
    for counts in platforms.values_mut() {
        counts.circuit_breaker =
            counts.dead_candidates > DEAD_LIMIT || counts.dead_candidates > counts.checked / 20;
        if counts.circuit_breaker || scan.is_err() {
            counts.pending.clear();
        }
    }
    // Small active battle boards (<20 posts) should still retire genuinely
    // removed posts; once >=20 are checked, enforce the 5% mass-outage guard.
    community.circuit_breaker = community.dead_candidates > DEAD_LIMIT
        || (community.checked >= 20 && community.dead_candidates > community.checked / 20);
    if community.circuit_breaker || community_scan.is_err() {
        community.pending_dead.clear();
    }
    match finish(&state, platforms, community, scan, community_scan, started).await {
        Ok((ok, detail)) => {
            crate::pages::expire_catalog(&state);
            let status = if ok {
                StatusCode::OK
            } else {
                StatusCode::BAD_GATEWAY
            };
            (status, [(CACHE_CONTROL, "no-store")], Json(detail)).into_response()
        }
        Err(error) => {
            tracing::error!(%error, "dead link sweep completion failed");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

const PAGE: &str = "WITH page AS (SELECT id, platform, content_id, url FROM public.meme_contents \
    WHERE id >= COALESCE($1::text::uuid, '00000000-0000-0000-0000-000000000000'::uuid) \
    AND id IS DISTINCT FROM $1::text::uuid AND availability = 'live' \
    AND moderation_status = 'approved' AND type IN ('embed', 'video') \
    ORDER BY id LIMIT 250) SELECT row_to_json(page)::text FROM page ORDER BY id";

async fn scan(
    state: &AppState,
    platforms: &mut Platforms,
    deadline: Instant,
) -> Result<bool, String> {
    let mut cursor = None;
    loop {
        let Ok(page) = timeout_at(
            deadline,
            db::rows(state, PAGE, vec![cursor], Some(DB_TIMEOUT_MS)),
        )
        .await
        else {
            return Ok(false);
        };
        let page = page?
            .into_iter()
            .map(serde_json::from_value)
            .collect::<Result<Vec<Link>, _>>()
            .map_err(|error| error.to_string())?;
        let Some(last) = page.last() else {
            return Ok(true);
        };
        cursor = bind(&last.id);
        let mut blocked = Vec::new();
        let complete = timeout_at(deadline, check_page(state, page, platforms, &mut blocked))
            .await
            .is_ok();
        if !blocked.is_empty() {
            let updated = state
                .db
                .with_identity(&DbIdentity::service_role(), db_options(), |tx| {
                    Box::pin(async move { update(tx, blocked.iter(), "region_blocked").await })
                })
                .await
                .map_err(|error: sqlx::Error| error.to_string())?;
            for platform in updated {
                platforms
                    .get_mut(platform.as_str())
                    .expect("a checked platform")
                    .region_blocked += 1;
            }
            crate::pages::expire_catalog(state);
        }
        if !complete {
            return Ok(false);
        }
    }
}

async fn check_page(
    state: &AppState,
    page: Vec<Link>,
    platforms: &mut Platforms,
    blocked: &mut Vec<Link>,
) {
    let mut youtube_rows = Vec::new();
    for link in page {
        let counts = platforms
            .get_mut(link.platform())
            .expect("a reported platform");
        match link.platform() {
            "YouTube" | "YouTube Shorts" => match link.identity(Platform::Youtube) {
                Some(id) => youtube_rows.push((link, id)),
                None => counts.skipped += 1,
            },
            "Instagram" => {
                let Some(url) = link.identity(Platform::Instagram) else {
                    counts.skipped += 1;
                    continue;
                };
                sleep(REQUEST_PAUSE).await;
                match state.oembed.instagram_post_missing(&url).await {
                    Some(missing) => {
                        counts.checked += 1;
                        if missing {
                            counts.gone(link);
                        }
                    }
                    None => counts.errors += 1,
                }
            }
            // TikTok oEmbed returns a bare player for invented IDs, and the
            // video page can return a challenge instead of its status data.
            // X returns the same 404 for a live /i/web/status/ URL as for a missing post.
            _ => counts.skipped += 1,
        }
    }
    let mut rows = youtube_rows.into_iter();
    loop {
        let batch: Vec<_> = rows.by_ref().take(YOUTUBE_BATCH).collect();
        if batch.is_empty() {
            break;
        }
        let ids: Vec<_> = batch.iter().map(|(_, id)| id.clone()).collect();
        sleep(REQUEST_PAUSE).await;
        let statuses = youtube::fetch_statuses(state, &ids).await;
        for (link, id) in batch {
            let counts = platforms
                .get_mut(link.platform())
                .expect("a YouTube platform");
            let Ok(statuses) = &statuses else {
                counts.errors += 1;
                continue;
            };
            counts.checked += 1;
            match statuses.get(&id) {
                Some(status) if status.privacy_status == "public" => {
                    if youtube::region_blocked(status) {
                        blocked.push(link);
                    }
                }
                _ => counts.gone(link),
            }
        }
    }
}

fn db_options() -> IdentityOptions {
    IdentityOptions {
        statement_timeout_ms: DB_TIMEOUT_MS,
    }
}

// An editor or source refresh may have changed this row during the sweep.
// Require the same platform and identity and that it still qualifies.
const UPDATE: &str = "UPDATE public.meme_contents AS c SET availability = $2::text::public.availability_status \
    FROM jsonb_to_recordset($1::text::jsonb) AS checked(id uuid, platform text, content_id text, url text) \
    WHERE c.id = checked.id AND c.platform = checked.platform \
    AND c.content_id IS NOT DISTINCT FROM checked.content_id AND c.url IS NOT DISTINCT FROM checked.url \
    AND c.availability = 'live' AND c.moderation_status = 'approved' AND c.type IN ('embed', 'video') \
    RETURNING c.platform";

async fn update(
    tx: &mut PgConnection,
    links: impl Iterator<Item = &Link>,
    availability: &str,
) -> sqlx::Result<Vec<String>> {
    let links: Vec<_> = links.collect();
    if links.is_empty() {
        return Ok(Vec::new());
    }
    sqlx::query_scalar(UPDATE)
        .bind(json!(links).to_string())
        .bind(availability)
        .fetch_all(tx)
        .await
}

const COMMUNITY_PAGE: &str = "WITH page AS ( \
    SELECT id, origin_source_platform AS platform, origin_source_url AS url \
    FROM public.community_posts \
    WHERE id >= COALESCE($1::text::uuid, '00000000-0000-0000-0000-000000000000'::uuid) \
      AND id IS DISTINCT FROM $1::text::uuid \
      AND status = 'visible' \
      AND created_at >= now() - interval '35 days' \
      AND origin_source_url IS NOT NULL \
      AND origin_source_platform IN ('youtube', 'youtube_shorts', 'instagram') \
      AND origin_source_availability IN ('live', 'unchecked') \
    ORDER BY id LIMIT 250 \
) SELECT row_to_json(page)::text FROM page ORDER BY id";

async fn scan_community_origins(
    state: &AppState,
    counts: &mut CommunityCounts,
    deadline: Instant,
) -> Result<bool, String> {
    let mut cursor = None;
    loop {
        let Ok(page) = timeout_at(
            deadline,
            db::rows(state, COMMUNITY_PAGE, vec![cursor], Some(DB_TIMEOUT_MS)),
        )
        .await
        else {
            return Ok(false);
        };
        let page = page?
            .into_iter()
            .map(serde_json::from_value)
            .collect::<Result<Vec<CommunityOriginLink>, _>>()
            .map_err(|error| error.to_string())?;
        let Some(last) = page.last() else {
            return Ok(true);
        };
        cursor = bind(&last.id);
        let complete = timeout_at(deadline, check_community_page(state, page, counts))
            .await
            .is_ok();
        if !complete {
            return Ok(false);
        }
    }
}

async fn check_community_page(
    state: &AppState,
    page: Vec<CommunityOriginLink>,
    counts: &mut CommunityCounts,
) {
    let mut youtube_rows = Vec::new();
    for link in page {
        match link.platform.as_str() {
            "youtube" | "youtube_shorts" => match link.identity(Platform::Youtube) {
                Some(id) => youtube_rows.push((link, id)),
                None => counts.skipped += 1,
            },
            "instagram" => {
                let Some(url) = link.identity(Platform::Instagram) else {
                    counts.skipped += 1;
                    continue;
                };
                sleep(REQUEST_PAUSE).await;
                match state.oembed.instagram_post_missing(&url).await {
                    Some(missing) => {
                        counts.checked += 1;
                        if missing {
                            counts.gone(link);
                        } else {
                            counts.pending_live.push(link);
                        }
                    }
                    None => counts.errors += 1,
                }
            }
            _ => counts.skipped += 1,
        }
    }
    let mut rows = youtube_rows.into_iter();
    loop {
        let batch: Vec<_> = rows.by_ref().take(YOUTUBE_BATCH).collect();
        if batch.is_empty() {
            break;
        }
        let ids: Vec<_> = batch.iter().map(|(_, id)| id.clone()).collect();
        sleep(REQUEST_PAUSE).await;
        let statuses = youtube::fetch_statuses(state, &ids).await;
        for (link, id) in batch {
            let Ok(statuses) = &statuses else {
                counts.errors += 1;
                continue;
            };
            counts.checked += 1;
            match statuses.get(&id) {
                Some(status) if status.privacy_status == "public" => {
                    if youtube::region_blocked(status) {
                        counts.pending_blocked.push(link);
                    } else {
                        counts.pending_live.push(link);
                    }
                }
                _ => counts.gone(link),
            }
        }
    }
}

// Guard updates against concurrent edits: require the same URL and active status.
const UPDATE_COMMUNITY: &str = "UPDATE public.community_posts AS cp \
    SET origin_source_availability = $2::text::public.availability_status, \
        origin_source_checked_at = clock_timestamp() \
    FROM jsonb_to_recordset($1::text::jsonb) AS checked(id uuid, platform text, url text) \
    WHERE cp.id = checked.id \
      AND cp.origin_source_platform = checked.platform \
      AND cp.origin_source_url IS NOT DISTINCT FROM checked.url \
      AND cp.origin_source_availability IN ('live', 'unchecked') \
    RETURNING cp.id::text";

async fn update_community(
    tx: &mut PgConnection,
    links: &[CommunityOriginLink],
    availability: &str,
) -> sqlx::Result<usize> {
    if links.is_empty() {
        return Ok(0);
    }
    let updated: Vec<String> = sqlx::query_scalar(UPDATE_COMMUNITY)
        .bind(json!(links).to_string())
        .bind(availability)
        .fetch_all(tx)
        .await?;
    Ok(updated.len())
}

async fn finish(
    state: &AppState,
    mut platforms: Platforms,
    mut community: CommunityCounts,
    scan: Result<bool, String>,
    community_scan: Result<bool, String>,
    started: String,
) -> sqlx::Result<(bool, serde_json::Value)> {
    state.db.with_identity(&DbIdentity::service_role(), db_options(), |tx| {
        Box::pin(async move {
            let updated = update(tx, platforms.values().flat_map(|c| &c.pending), "dead").await?;
            for platform in updated {
                platforms.get_mut(platform.as_str()).expect("a checked platform").dead += 1;
            }
            community.live = update_community(tx, &community.pending_live, "live").await?;
            community.region_blocked =
                update_community(tx, &community.pending_blocked, "region_blocked").await?;
            community.dead = update_community(tx, &community.pending_dead, "dead").await?;
            let ok = scan == Ok(true)
                && community_scan == Ok(true)
                && platforms.values().all(|c| c.errors == 0 && !c.circuit_breaker)
                && community.errors == 0
                && !community.circuit_breaker;
            let detail = json!({
                "ok": ok,
                "deadline_reached": scan == Ok(false) || community_scan == Ok(false),
                "database_error": scan.is_err() || community_scan.is_err(),
                "platforms": platforms,
                "community_posts": community,
            });
            sqlx::query("INSERT INTO public.job_runs (job_name, started_at, finished_at, ok, detail) \
                VALUES ('dead_link_sweep', $1::text::timestamptz, clock_timestamp(), $2, $3::text::jsonb)")
                .bind(started).bind(ok).bind(detail.to_string()).execute(tx).await?;
            Ok((ok, detail))
        })
    }).await
}
