//! The writes both refresh providers make (`lib/sources/refresh.server.ts`):
//! a source's catalog availability, its removal, and its ledger records.

use super::db::{self, bind};
use super::recovery::{self, FailureInput, source_key};
use super::refresh::{SourceRow, iso_at, now_ms};
use super::refresh_select::provider_identity_key;
use super::url::Platform;
use crate::AppState;

const DAY_MS: i64 = 86_400_000;
const METADATA_TTL_DAYS: i64 = 30;

/// `daysFromNow(30)`.
pub fn metadata_expiry() -> String {
    iso_at(now_ms() + METADATA_TTL_DAYS * DAY_MS)
}

fn display_platform(platform: Platform) -> &'static str {
    match platform {
        Platform::Youtube => "YouTube",
        Platform::YoutubeShorts => "YouTube Shorts",
        Platform::Tiktok => "TikTok",
        Platform::Instagram => "Instagram",
    }
}

const SYNC: &str = "UPDATE public.meme_contents SET availability = $1::public.availability_status \
    WHERE platform = $2 AND content_id = $3 AND type = 'embed'::public.media_type \
    AND availability <> $1::public.availability_status";
const SYNC_LEGACY: &str = "UPDATE public.meme_contents SET availability = $1::public.availability_status \
    WHERE platform = 'YouTube' AND content_id = $2 AND url = $3 AND type = 'embed'::public.media_type \
    AND availability <> $1::public.availability_status";

/// `syncMemeContentsAvailability(source, availability)`.
pub async fn sync_availability(
    state: &AppState,
    source: &SourceRow,
    availability: &str,
) -> Result<(), String> {
    const FAILED: &str = "source_content_availability_update_failed";
    let platform = source.platform.map_or("", display_platform);
    let content_id = source.external_id.clone().unwrap_or_default();
    db::execute(
        state,
        SYNC,
        vec![bind(availability), bind(platform), bind(&content_id)],
    )
    .await
    .map_err(|_| FAILED.to_owned())?;
    // Legacy rows label Shorts and TikTok URLs as YouTube.
    if let (Some(external_id), false) = (
        &source.external_id,
        source.platform == Some(Platform::Youtube),
    ) {
        let binds = vec![
            bind(availability),
            bind(external_id),
            bind(&source.canonical_url),
        ];
        db::execute(state, SYNC_LEGACY, binds)
            .await
            .map_err(|_| FAILED.to_owned())?;
    }
    Ok(())
}

const REMOVE: &str = "UPDATE public.media_sources SET removed_at = $2::timestamptz, \
    last_checked_at = $2::timestamptz, title = NULL, thumbnail_url = NULL, \
    metadata_expires_at = NULL WHERE id = $1::uuid";

/// The update of a source the provider no longer has.
pub async fn mark_removed(state: &AppState, source: &SourceRow, now: &str) -> Result<(), String> {
    db::execute(state, REMOVE, vec![bind(&source.id), bind(now)])
        .await
        .map_err(|_| "source_refresh_update_failed".to_owned())
}

/// `quarantineInvalidIdentity(row, attemptedAt)`.
pub async fn quarantine(
    state: &AppState,
    row: &SourceRow,
    attempted_at: &str,
) -> Result<(), String> {
    let key = format!("invalid_identity:{}", row.id);
    let https = row
        .canonical_url
        .get(..8)
        .is_some_and(|scheme| scheme.eq_ignore_ascii_case("https://"));
    recovery::record_failure(
        state,
        &FailureInput {
            source_key: &key,
            idempotency_key: &format!("{key}:{attempted_at}"),
            platform: row.platform.unwrap_or(Platform::Youtube),
            source_id: Some(&row.id),
            external_id: None,
            canonical_url: https.then_some(row.canonical_url.as_str()),
            code: "metadata_mismatch",
            occurred_at: attempted_at,
        },
    )
    .await
    .map(|_| ())
}

/// `recordSourceAcquisitionFailure` under the source's own key.
pub async fn record_own_failure(
    state: &AppState,
    row: &SourceRow,
    idempotency_key: &str,
    code: &'static str,
    occurred_at: &str,
) -> Result<(), String> {
    let (Some(platform), Some(external_id)) = (row.platform, row.external_id.as_deref()) else {
        return Ok(());
    };
    recovery::record_failure(
        state,
        &FailureInput {
            source_key: &source_key(platform, external_id),
            idempotency_key,
            platform,
            source_id: Some(&row.id),
            external_id: Some(external_id),
            canonical_url: Some(&row.canonical_url),
            code,
            occurred_at,
        },
    )
    .await
    .map(|_| ())
}

/// `recordProviderIdentityFailure(row, attemptedAt, preserve, active)`.
pub async fn record_provider_identity_failure(
    state: &AppState,
    row: &SourceRow,
    attempted_at: &str,
    key: &str,
) -> Result<(), String> {
    let platform = row.platform.unwrap_or(Platform::Tiktok);
    recovery::record_failure(
        state,
        &FailureInput {
            source_key: key,
            idempotency_key: &format!("{key}:{attempted_at}"),
            platform,
            source_id: Some(&row.id),
            external_id: row.external_id.as_deref(),
            canonical_url: Some(&row.canonical_url),
            code: "provider_transient",
            occurred_at: attempted_at,
        },
    )
    .await
    .map(|_| ())
}

/// The key `recordProviderIdentityFailure` writes under.
pub fn provider_failure_key(row: &SourceRow, preserve_existing: bool) -> String {
    match (preserve_existing, row.platform, row.external_id.as_deref()) {
        (true, Some(platform), Some(external_id)) => source_key(platform, external_id),
        _ => provider_identity_key(row),
    }
}
