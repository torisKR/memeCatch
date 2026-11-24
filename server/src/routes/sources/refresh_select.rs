//! The first half of `runSourceRefresh` (`lib/sources/refresh.server.ts`):
//! releasing repaired identity quarantines, then choosing the sources to
//! check. Due retries and stale sources are looked up per platform group,
//! bounded, and kept away from recovery keys they cannot own.

use std::collections::{HashMap, HashSet};

use serde_json::Value;

use super::db::{self, Bind, bind};
use super::recovery::{self, Recovery, source_key};
use super::refresh::{Observations, SourceRow, iso_at, now_ms};
use super::url::{Platform, normalize_source_url};
use crate::AppState;

const DAY_MS: i64 = 86_400_000;
const YOUTUBE_BATCH_LIMIT: usize = 300;
const SOCIAL_PLATFORM_BATCH_LIMIT: usize = 30;
const STALE_CONFLICT_HEADROOM: usize = 50;
const SOURCE_LOOKUP_TIMEOUT_MS: u32 = 10_000;
const DUE_LOOKUP_MAX_BATCHES: usize = 4;
const DUE_LOOKUP_BUDGET_MS: i64 = 15_000;
const LOOKUP_BATCH: usize = 500;

/// What the selection found, and what the run reports about it.
pub struct Selection {
    pub active: Vec<Recovery>,
    pub youtube_rows: Vec<SourceRow>,
    pub oembed_rows: Vec<SourceRow>,
    pub unmatched_due_keys: usize,
    pub conflicting_stale: usize,
    pub unowned_keys: usize,
    pub first_error: Option<String>,
}

/// `normalizedSourceIdentity(row) !== null`.
pub fn identity_is_valid(row: &SourceRow) -> bool {
    let Some(external_id) = &row.external_id else {
        return false;
    };
    let Some(normalized) = normalize_source_url(&row.canonical_url) else {
        return false;
    };
    if &normalized.external_id != external_id || normalized.canonical_url != row.canonical_url {
        return false;
    }
    match row.platform {
        Some(platform) if platform.is_youtube() => normalized.platform.is_youtube(),
        Some(platform) => normalized.platform == platform,
        None => false,
    }
}

pub fn provider_identity_key(row: &SourceRow) -> String {
    format!("provider_identity:{}", row.id)
}

/// `recoveryMatchesSource(recovery, source)`.
pub fn recovery_matches(recovery: &Recovery, source: &SourceRow) -> bool {
    let (Some(platform), Some(external_id)) = (source.platform, &source.external_id) else {
        return false;
    };
    if recovery.source_id.as_deref() != Some(source.id.as_str()) || recovery.platform != platform {
        return false;
    }
    if recovery.source_key == source_key(platform, external_id) {
        return recovery
            .external_id
            .as_ref()
            .is_none_or(|id| id == external_id);
    }
    platform == Platform::Tiktok
        && recovery.source_key == provider_identity_key(source)
        && recovery.external_id.as_ref() == Some(external_id)
}

/// `canChangeRecoveryKey(activeRecovery, source, key)`.
pub fn can_change_key(active: &[Recovery], source: &SourceRow, key: &str) -> bool {
    active
        .iter()
        .find(|recovery| recovery.source_key == key)
        .is_none_or(|recovery| recovery_matches(recovery, source))
}

/// `source.external_id && !canChangeRecoveryKey(..., sourceAcquisitionKey(...))`.
pub fn own_key_is_held(active: &[Recovery], source: &SourceRow) -> bool {
    match (source.platform, &source.external_id) {
        (Some(platform), Some(external_id)) => {
            !can_change_key(active, source, &source_key(platform, external_id))
        }
        _ => false,
    }
}

/// `recoveryKeyIsSelfConsistent(recovery)`.
fn self_consistent(recovery: &Recovery) -> bool {
    if recovery.source_key.starts_with("provider_identity:") {
        return recovery.platform == Platform::Tiktok && recovery.external_id.is_some();
    }
    let prefix = format!("{}:", recovery.platform.as_str());
    match recovery.source_key.strip_prefix(&prefix) {
        Some(id) => recovery
            .external_id
            .as_deref()
            .is_none_or(|external| external == id),
        None => false,
    }
}

/// `staleRecoveryExclusion(active, platforms)`: the external ids to keep out
/// of the stale lookup (as a `text[]` literal), and how many unowned keys.
fn stale_exclusion(active: &[Recovery], platforms: &[Platform]) -> (Option<String>, usize) {
    let mut unowned: Vec<&str> = Vec::new();
    for recovery in active
        .iter()
        .filter(|recovery| platforms.contains(&recovery.platform))
    {
        let prefix = format!("{}:", recovery.platform.as_str());
        let Some(external_id) = recovery
            .source_key
            .strip_prefix(&prefix)
            .filter(|id| !id.is_empty())
        else {
            continue;
        };
        let owned = recovery.source_id.is_some()
            && recovery
                .external_id
                .as_deref()
                .is_none_or(|recorded| recorded == external_id);
        if !owned && !unowned.contains(&external_id) {
            unowned.push(external_id);
        }
    }
    let listed: Vec<&str> = unowned
        .iter()
        .copied()
        .filter(|id| !id.contains([',', '(', ')', '"', '\\']))
        .collect();
    let filter = (!listed.is_empty()).then(|| pg_array(&listed));
    (filter, unowned.len())
}

/// node-pg's `arrayString` for a list of strings.
pub fn pg_array(items: &[&str]) -> String {
    let quoted: Vec<String> = items
        .iter()
        .map(|item| format!("\"{}\"", item.replace('\\', "\\\\").replace('"', "\\\"")))
        .collect();
    format!("{{{}}}", quoted.join(","))
}

fn source_row(value: &Value) -> SourceRow {
    SourceRow {
        id: db::text(value, "id").unwrap_or_default().to_owned(),
        platform: db::text(value, "platform").and_then(Platform::parse),
        external_id: db::text(value, "external_id").map(str::to_owned),
        canonical_url: db::text(value, "canonical_url")
            .unwrap_or_default()
            .to_owned(),
    }
}

const BY_IDS: &str = "WITH __q AS (SELECT id, platform, external_id, canonical_url, embeddable, removed_at \
    FROM public.media_sources WHERE id = ANY($1::uuid[])) SELECT row_to_json(__q)::text FROM __q";
const IDENTITY_BY_IDS: &str = "WITH __q AS (SELECT id, platform, external_id, canonical_url \
    FROM public.media_sources WHERE id = ANY($1::uuid[])) SELECT row_to_json(__q)::text FROM __q";
const STALE: &str = "WITH __q AS (SELECT id, platform, external_id, canonical_url, embeddable, removed_at \
    FROM public.media_sources WHERE platform = ANY($1::text[]) \
    AND (last_checked_at IS NULL OR last_checked_at < $2::timestamptz) \
    AND ($3::text[] IS NULL OR external_id IS NULL OR NOT (external_id = ANY($3::text[]))) \
    AND ($4::uuid[] IS NULL OR NOT (id = ANY($4::uuid[]))) \
    ORDER BY last_checked_at ASC NULLS FIRST, id ASC LIMIT $5::bigint) SELECT row_to_json(__q)::text FROM __q";

async fn rows_by_ids(
    state: &AppState,
    sql: &'static str,
    ids: &[&str],
    timeout: Option<u32>,
) -> Result<Vec<SourceRow>, String> {
    let rows = db::rows(state, sql, vec![bind(&pg_array(ids))], timeout).await?;
    Ok(rows.iter().map(source_row).collect())
}

/// Releases each `invalid_identity:` quarantine whose source now has a valid
/// identity, then reads the ledger again. `Err` ends the run (it throws).
pub async fn repair_identities(
    state: &AppState,
    active: Vec<Recovery>,
) -> Result<Vec<Recovery>, String> {
    let quarantines: Vec<&Recovery> = active
        .iter()
        .filter(|row| {
            row.source_id
                .as_ref()
                .is_some_and(|id| row.source_key == format!("invalid_identity:{id}"))
                && row.last_error_code == "metadata_mismatch"
        })
        .collect();
    if quarantines.is_empty() {
        return Ok(active);
    }
    let attempt = iso_at(now_ms());
    for batch in quarantines.chunks(LOOKUP_BATCH) {
        let ids: Vec<&str> = batch
            .iter()
            .filter_map(|row| row.source_id.as_deref())
            .collect();
        let sources = rows_by_ids(state, IDENTITY_BY_IDS, &ids, None)
            .await
            .map_err(|_| "source_identity_repair_lookup_failed".to_owned())?;
        let by_id: HashMap<&str, &SourceRow> =
            sources.iter().map(|row| (row.id.as_str(), row)).collect();
        for recovery in batch {
            let Some(source) = recovery.source_id.as_deref().and_then(|id| by_id.get(id)) else {
                continue;
            };
            if source.external_id.is_none() || !identity_is_valid(source) {
                continue;
            }
            let key = format!("identity-repair:{}:{attempt}", source.id);
            recovery::resolve(
                state,
                &recovery.source_key,
                &key,
                &attempt,
                &iso_at(now_ms()),
            )
            .await?;
        }
    }
    recovery::list_active(state).await
}

/// `Date.parse(nextRetryAt) <= nowMs` (`false` for `NaN`).
fn due_at(next_retry_at: Option<&str>, now: i64) -> Option<i128> {
    let at = crate::routes::chat::facts::date_parse(next_retry_at?)?;
    (at <= i128::from(now)).then_some(at)
}

fn later(next_retry_at: Option<&str>, now: i64) -> bool {
    next_retry_at
        .and_then(crate::routes::chat::facts::date_parse)
        .is_some_and(|at| at > i128::from(now))
}

/// The group of `platform` and its limit.
fn group_of(platform: Platform) -> (usize, usize) {
    match platform {
        Platform::Youtube | Platform::YoutubeShorts => (0, YOUTUBE_BATCH_LIMIT),
        Platform::Tiktok => (1, SOCIAL_PLATFORM_BATCH_LIMIT),
        Platform::Instagram => (2, SOCIAL_PLATFORM_BATCH_LIMIT),
    }
}

/// The rest of the selection, from the due and active ledgers.
pub async fn select(
    state: &AppState,
    due: Vec<Recovery>,
    active: Vec<Recovery>,
    started_ms: i64,
) -> Selection {
    let now = now_ms();
    let deferred: Vec<&str> = active
        .iter()
        .filter(|row| row.next_retry_at.is_none() || later(row.next_retry_at.as_deref(), now))
        .filter_map(|row| row.source_id.as_deref())
        .collect();
    let deferred_set: HashSet<&str> = deferred.iter().copied().collect();
    let due_plan = DuePlan::new(&due, &active, &deferred_set, now);
    let mut stale = stale_rows(state, &active, &deferred).await;
    let (due_rows, lookup_failed, unmatched) = due_plan.look_up(state, &active, started_ms).await;
    if lookup_failed {
        stale
            .errors
            .push("source_recovery_candidate_lookup_failed".to_owned());
    }
    let (youtube_rows, oembed_rows) = choose(&active, &deferred_set, due_rows, stale.rows, now);
    Selection {
        youtube_rows,
        oembed_rows,
        unmatched_due_keys: unmatched,
        conflicting_stale: stale.conflicting,
        unowned_keys: stale.unowned_keys,
        first_error: (!stale.errors.is_empty()).then(|| stale.errors.join("; ")),
        active,
    }
}

/// The stale-source lookups and what they report.
struct Stale {
    rows: Vec<SourceRow>,
    errors: Vec<String>,
    conflicting: usize,
    unowned_keys: usize,
}

/// One bounded lookup per platform group, side by side. A group whose
/// lookup fails is skipped; the others still count.
async fn stale_rows(state: &AppState, active: &[Recovery], deferred: &[&str]) -> Stale {
    let stale_before = iso_at(now_ms() - DAY_MS);
    let deferred_filter = (!deferred.is_empty()).then(|| pg_array(deferred));
    let groups: [(&str, &[Platform], usize); 3] = [
        (
            "youtube",
            &[Platform::Youtube, Platform::YoutubeShorts],
            YOUTUBE_BATCH_LIMIT,
        ),
        ("tiktok", &[Platform::Tiktok], SOCIAL_PLATFORM_BATCH_LIMIT),
        (
            "instagram",
            &[Platform::Instagram],
            SOCIAL_PLATFORM_BATCH_LIMIT,
        ),
    ];
    let mut unowned_keys = 0;
    let [youtube, tiktok, instagram] = groups.map(|(group, platforms, limit)| {
        let (exclusion, unowned) = stale_exclusion(active, platforms);
        unowned_keys += unowned;
        let names: Vec<&str> = platforms.iter().map(|platform| platform.as_str()).collect();
        let binds: Vec<Bind> = vec![
            bind(&pg_array(&names)),
            bind(&stale_before),
            exclusion,
            deferred_filter.clone(),
            bind(&(limit + STALE_CONFLICT_HEADROOM).to_string()),
        ];
        async move {
            let rows = db::rows(state, STALE, binds, Some(SOURCE_LOOKUP_TIMEOUT_MS)).await;
            (group, limit, rows)
        }
    });
    let (youtube, tiktok, instagram) = tokio::join!(youtube, tiktok, instagram);
    let mut stale = Stale {
        rows: Vec::new(),
        errors: Vec::new(),
        conflicting: 0,
        unowned_keys,
    };
    let mut conflicting: HashSet<String> = HashSet::new();
    for (group, limit, result) in [youtube, tiktok, instagram] {
        let Ok(rows) = result else {
            stale
                .errors
                .push(format!("source_stale_lookup_failed:{group}"));
            continue;
        };
        let mut selected = 0;
        for source in rows.iter().map(source_row) {
            // The database exclusion is a pre-filter; this check stays authoritative.
            if own_key_is_held(active, &source) {
                conflicting.insert(source.id.clone());
                continue;
            }
            stale.rows.push(source);
            selected += 1;
            if selected >= limit {
                break;
            }
        }
    }
    stale.conflicting = conflicting.len();
    stale
}

/// The due rows then the stale ones, once each, minus deferred sources and
/// sources whose recovery is not due; then each platform's share.
fn choose(
    active: &[Recovery],
    deferred: &HashSet<&str>,
    due_rows: Vec<SourceRow>,
    stale: Vec<SourceRow>,
    now: i64,
) -> (Vec<SourceRow>, Vec<SourceRow>) {
    // `new Map(rows.map(row => [row.id, row]))`: first place, last value.
    let mut candidates: Vec<SourceRow> = Vec::new();
    for row in due_rows.into_iter().chain(stale) {
        match candidates.iter_mut().find(|known| known.id == row.id) {
            Some(known) => *known = row,
            None => candidates.push(row),
        }
    }
    let mut recovery_by_source: HashMap<&str, &Recovery> = HashMap::new();
    for row in active {
        if let Some(id) = row.source_id.as_deref() {
            recovery_by_source.insert(id, row);
        }
    }
    let rows: Vec<SourceRow> = candidates
        .into_iter()
        .filter(|row| {
            !deferred.contains(row.id.as_str())
                && recovery_by_source
                    .get(row.id.as_str())
                    .is_none_or(|recovery| due_at(recovery.next_retry_at.as_deref(), now).is_some())
        })
        .collect();
    let youtube = rows
        .iter()
        .filter(|row| row.platform.is_some_and(Platform::is_youtube))
        .take(YOUTUBE_BATCH_LIMIT)
        .cloned()
        .collect();
    let social = [Platform::Tiktok, Platform::Instagram]
        .iter()
        .flat_map(|platform| {
            rows.iter()
                .filter(|row| row.platform == Some(*platform))
                .take(SOCIAL_PLATFORM_BATCH_LIMIT)
                .cloned()
                .collect::<Vec<_>>()
        })
        .collect();
    (youtube, social)
}

/// The due retries grouped by source, in the order they are looked up.
struct DuePlan {
    /// `dueBySource`, in insertion order.
    by_source: Vec<(String, Vec<Recovery>)>,
    /// Keys that can match no source, counted once each.
    unmatched: usize,
}

impl DuePlan {
    fn new(due: &[Recovery], active: &[Recovery], deferred: &HashSet<&str>, now: i64) -> Self {
        let mut candidates: Vec<(i128, &Recovery)> = due
            .iter()
            .chain(active)
            .filter(|row| {
                row.source_id
                    .as_deref()
                    .is_some_and(|id| !deferred.contains(id))
            })
            .filter_map(|row| due_at(row.next_retry_at.as_deref(), now).map(|at| (at, row)))
            .collect();
        candidates.sort_by(|(a_at, a), (b_at, b)| {
            a_at.cmp(b_at).then_with(|| a.source_id.cmp(&b.source_id))
        });
        let mut counted: HashSet<&str> = HashSet::new();
        let mut by_source: Vec<(String, Vec<Recovery>)> = Vec::new();
        for (_, recovery) in candidates {
            let Some(source_id) = recovery.source_id.as_deref() else {
                continue;
            };
            if !self_consistent(recovery) {
                counted.insert(&recovery.source_key);
                continue;
            }
            let at = match by_source.iter().position(|(id, _)| id == source_id) {
                Some(at) => at,
                None => {
                    by_source.push((source_id.to_owned(), Vec::new()));
                    by_source.len() - 1
                }
            };
            let entries = &mut by_source[at].1;
            if !entries
                .iter()
                .any(|entry| entry.source_key == recovery.source_key)
            {
                entries.push(recovery.clone());
            }
        }
        Self {
            by_source,
            unmatched: counted.len(),
        }
    }

    /// The platform groups interleaved, oldest retry first within each.
    fn interleaved(&self) -> Vec<&str> {
        let mut queues: Vec<(usize, Vec<&str>)> = Vec::new();
        for (id, recoveries) in &self.by_source {
            let group = group_of(recoveries[0].platform).0;
            match queues.iter_mut().find(|(known, _)| *known == group) {
                Some((_, queue)) => queue.push(id),
                None => queues.push((group, vec![id])),
            }
        }
        let longest = queues
            .iter()
            .map(|(_, queue)| queue.len())
            .max()
            .unwrap_or(0);
        (0..longest)
            .flat_map(|index| {
                queues
                    .iter()
                    .filter_map(move |(_, queue)| queue.get(index).copied())
            })
            .collect()
    }

    fn recoveries(&self, id: &str) -> &[Recovery] {
        self.by_source
            .iter()
            .find(|(known, _)| known == id)
            .map_or(&[][..], |(_, recoveries)| recoveries)
    }

    /// The capped lookups of the due sources: the rows, whether a lookup
    /// failed, and the unmatched key count.
    async fn look_up(
        &self,
        state: &AppState,
        active: &[Recovery],
        started_ms: i64,
    ) -> (Vec<SourceRow>, bool, usize) {
        let ids = self.interleaved();
        let mut counts = [0usize; 3];
        let mut rows = Vec::new();
        let mut unmatched = self.unmatched;
        let mut lookups = 0;
        for slice in ids.chunks(LOOKUP_BATCH) {
            let full = |platform| {
                let (group, limit) = group_of(platform);
                counts[group] >= limit
            };
            if lookups >= DUE_LOOKUP_MAX_BATCHES || now_ms() >= started_ms + DUE_LOOKUP_BUDGET_MS {
                break;
            }
            if [Platform::Youtube, Platform::Tiktok, Platform::Instagram]
                .into_iter()
                .all(full)
            {
                break;
            }
            let wanted: Vec<&str> = slice
                .iter()
                .copied()
                .filter(|id| {
                    self.recoveries(id)
                        .iter()
                        .any(|recovery| !full(recovery.platform))
                })
                .collect();
            if wanted.is_empty() {
                continue;
            }
            lookups += 1;
            let Ok(found) =
                rows_by_ids(state, BY_IDS, &wanted, Some(SOURCE_LOOKUP_TIMEOUT_MS)).await
            else {
                return (rows, true, unmatched);
            };
            for id in wanted {
                let recoveries = self.recoveries(id);
                let source = found.iter().find(|row| row.id == id);
                let matches = source.map_or(0, |source| {
                    recoveries
                        .iter()
                        .filter(|recovery| recovery_matches(recovery, source))
                        .count()
                });
                unmatched += recoveries.len() - matches;
                if let Some(source) = source.filter(|_| matches > 0) {
                    take(source, active, &mut counts, &mut rows);
                }
            }
        }
        (rows, false, unmatched)
    }
}

/// Keeps a matched due source unless its own key is held or its platform's
/// share is full.
fn take(
    source: &SourceRow,
    active: &[Recovery],
    counts: &mut [usize; 3],
    rows: &mut Vec<SourceRow>,
) {
    let Some(platform) = source.platform else {
        return;
    };
    let (group, limit) = group_of(platform);
    if own_key_is_held(active, source) || counts[group] >= limit {
        return;
    }
    counts[group] += 1;
    rows.push(source.clone());
}

/// `observations[row.platform].selected += 1` for every chosen row.
pub fn count_selected(observations: &mut Observations, selection: &Selection) {
    for row in selection.youtube_rows.iter().chain(&selection.oembed_rows) {
        if let Some(platform) = row.platform {
            observations.get(platform).selected += 1;
        }
    }
}
