//! `refreshYouTubeSources` of `lib/sources/refresh.server.ts`: one
//! `videos.list` pass over the selected YouTube and Shorts sources, then a
//! write per source.
//!
//! `youtube-response.mjs` refuses any answer whose `privacyStatus` or
//! `embeddable` is missing, so the TypeScript's "inconclusive" branch
//! (`source_status_inconclusive`) cannot run; it is left out here.

use super::db::{self, Bind, bind};
use super::recovery::{self, Recovery, source_key};
use super::refresh::{Observations, SourceRow, YoutubeOutcome, iso_at, now_ms};
use super::refresh_select::{identity_is_valid, own_key_is_held};
use super::refresh_writes::{
    mark_removed, metadata_expiry, quarantine, record_own_failure, sync_availability,
};
use super::youtube::{self, VideoStatus, number_text, pg_text, region_blocked};
use crate::AppState;

/// The run's outcome and observations, or the thrown message with the
/// observations made before it.
pub type Refreshed = Result<(YoutubeOutcome, Observations), (String, Observations)>;

pub async fn refresh(state: &AppState, rows: &[SourceRow], active: &[Recovery]) -> Refreshed {
    let mut seen = Observations::default();
    let (valid, invalid): (Vec<&SourceRow>, Vec<&SourceRow>) =
        rows.iter().partition(|row| identity_is_valid(row));
    let mut errors = quarantine_invalid(state, &invalid, &mut seen).await;
    let mut outcome = YoutubeOutcome {
        checked: rows.len(),
        failed: invalid.len(),
        ..YoutubeOutcome::default()
    };
    if valid.is_empty() {
        outcome.errors = errors;
        return Ok((outcome, seen));
    }
    let started = iso_at(now_ms());
    for row in &valid {
        seen.get(platform_of(row)).provider_submitted += 1;
    }
    let ids: Vec<String> = valid
        .iter()
        .filter_map(|row| row.external_id.clone())
        .collect();
    let statuses = match youtube::fetch_statuses(state, &ids).await {
        Ok(statuses) => statuses,
        Err(message) => {
            for row in &valid {
                seen.get(platform_of(row)).inconclusive += 1;
            }
            let thrown = record_provider_failure(state, &valid, active, &started)
                .await
                .err()
                .unwrap_or(message);
            return Err((thrown, seen));
        }
    };
    let now = iso_at(now_ms());
    for row in valid {
        seen.get(platform_of(row)).confirmed += 1;
        let status = row.external_id.as_ref().and_then(|id| statuses.get(id));
        let key = attempt_key(row, &started);
        match write(state, row, status, &now, active, &key, &started).await {
            Ok(Effect::Removed) => outcome.removed += 1,
            Ok(Effect::Hidden) => outcome.hidden += 1,
            Ok(Effect::Kept) => {}
            Err(message) => {
                outcome.failed += 1;
                errors.push(message);
                errors.extend(record_write_failure(state, row, active, &key, &started).await);
            }
        }
    }
    outcome.errors = errors;
    Ok((outcome, seen))
}

/// `refresh:<source id>:<attempt start>`.
fn attempt_key(row: &SourceRow, started: &str) -> String {
    format!("refresh:{}:{started}", row.id)
}

/// Counts and quarantines the rows whose identity is not canonical; the
/// errors they add.
async fn quarantine_invalid(
    state: &AppState,
    invalid: &[&SourceRow],
    seen: &mut Observations,
) -> Vec<String> {
    let mut errors = Vec::new();
    for row in invalid {
        if let Some(platform) = row.platform {
            seen.get(platform).invalid_identity += 1;
        }
        errors.push(format!("invalid_source_identity:{}", row.id));
    }
    let attempted_at = iso_at(now_ms());
    for row in invalid {
        if quarantine(state, row, &attempted_at).await.is_err() {
            errors.push(format!("invalid_identity_quarantine_failed:{}", row.id));
        }
    }
    errors
}

/// The ledger records after `videos.list` failed. Not caught in the
/// TypeScript: a ledger failure replaces the provider's error.
async fn record_provider_failure(
    state: &AppState,
    valid: &[&SourceRow],
    active: &[Recovery],
    started: &str,
) -> Result<(), String> {
    for row in valid {
        if !own_key_is_held(active, row) {
            let key = attempt_key(row, started);
            record_own_failure(state, row, &key, "provider_transient", started).await?;
        }
    }
    Ok(())
}

/// The `catch` of one row's writes: the errors it adds.
async fn record_write_failure(
    state: &AppState,
    row: &SourceRow,
    active: &[Recovery],
    key: &str,
    started: &str,
) -> Option<String> {
    row.external_id.as_ref()?;
    if own_key_is_held(active, row) {
        return Some(format!("source_recovery_identity_mismatch:{}", row.id));
    }
    record_own_failure(state, row, key, "db_failure", started)
        .await
        .err()
}

fn platform_of(row: &SourceRow) -> super::url::Platform {
    row.platform.unwrap_or(super::url::Platform::Youtube)
}

enum Effect {
    Removed,
    Hidden,
    Kept,
}

const UPDATE: &str = "UPDATE public.media_sources SET title = $2, channel_name = $3, channel_id = $4, \
    platform_published_at = $5::timestamptz, duration_seconds = $6::bigint, public_status = $7, \
    removed_at = $8::timestamptz, embeddable = $9::boolean, license_code = $10, \
    made_for_kids = $11::boolean, thumbnail_url = $12, metadata_refreshed_at = $13::timestamptz, \
    metadata_expires_at = $14::timestamptz, last_checked_at = $13::timestamptz WHERE id = $1::uuid";

/// The writes for one source (the body of the TypeScript's `try`).
async fn write(
    state: &AppState,
    row: &SourceRow,
    status: Option<&VideoStatus>,
    now: &str,
    active: &[Recovery],
    attempt_key: &str,
    started: &str,
) -> Result<Effect, String> {
    let Some(status) = status else {
        // Deleted or made private: drop the cached metadata, hide the posts.
        sync_availability(state, row, "dead").await?;
        mark_removed(state, row, now).await?;
        resolve_own(state, row, active, attempt_key, started, now).await?;
        return Ok(Effect::Removed);
    };
    let public = status.privacy_status == "public";
    let private = status.privacy_status == "private";
    let embeddable = public && status.embeddable;
    let blocked = region_blocked(status);
    let availability = match (public, blocked) {
        (false, _) => "dead",
        (true, true) => "region_blocked",
        (true, false) => "live",
    };
    // Hide before a negative status is stored; store a restored one first.
    if availability != "live" {
        sync_availability(state, row, availability).await?;
    }
    db::execute(
        state,
        UPDATE,
        update_binds(row, status, private, embeddable, now),
    )
    .await
    .map_err(|_| "source_refresh_update_failed".to_owned())?;
    if availability == "live" {
        sync_availability(state, row, availability).await?;
    }
    let effect = if private {
        Effect::Removed
    } else if !public || (!blocked && !embeddable) {
        Effect::Hidden
    } else {
        Effect::Kept
    };
    resolve_own(state, row, active, attempt_key, started, now).await?;
    Ok(effect)
}

fn update_binds(
    row: &SourceRow,
    status: &VideoStatus,
    private: bool,
    embeddable: bool,
    now: &str,
) -> Vec<Bind> {
    vec![
        bind(&row.id),
        if private {
            None
        } else {
            pg_text(&status.title)
        },
        pg_text(&status.channel_title),
        pg_text(&status.channel_id),
        pg_text(&status.published_at),
        status.duration_seconds.map(number_text),
        bind(&status.privacy_status),
        private.then(|| now.to_owned()),
        bind(if embeddable { "true" } else { "false" }),
        pg_text(&status.license),
        pg_text(&status.made_for_kids),
        if private {
            None
        } else {
            pg_text(&status.thumbnail_url)
        },
        bind(now),
        (!private).then(metadata_expiry),
    ]
}

async fn resolve_own(
    state: &AppState,
    row: &SourceRow,
    active: &[Recovery],
    attempt_key: &str,
    started: &str,
    now: &str,
) -> Result<(), String> {
    let (Some(platform), Some(external_id)) = (row.platform, row.external_id.as_deref()) else {
        return Ok(());
    };
    if own_key_is_held(active, row) {
        return Ok(());
    }
    recovery::resolve(
        state,
        &source_key(platform, external_id),
        attempt_key,
        started,
        now,
    )
    .await
}
