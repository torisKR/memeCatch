//! `refreshOEmbedSources` of `lib/sources/refresh.server.ts`: TikTok or
//! Instagram sources, one at a time through the shared oEmbed client, until
//! the provider budget runs out.

use super::db::{self, bind};
use super::recovery::{self, Recovery, source_key};
use super::refresh::{Observations, SocialOutcome, SourceRow, iso_at, now_ms};
use super::refresh_select::{
    can_change_key, identity_is_valid, own_key_is_held, provider_identity_key, recovery_matches,
};
use super::refresh_writes::{
    mark_removed, metadata_expiry, provider_failure_key, quarantine, record_own_failure,
    record_provider_identity_failure, sync_availability,
};
use super::url::Platform;
use crate::AppState;
use crate::oembed::{Failure, OEmbedResult};
use crate::routes::js_string::JsString;

/// One row's place in the counts, as the TypeScript's `continue`s leave it.
struct Row<'a> {
    state: &'a AppState,
    row: &'a SourceRow,
    active: &'a [Recovery],
    attempted_at: String,
    attempt_key: String,
    /// The `provider_identity:` recovery of the row matches it.
    may_resolve_provider: bool,
    /// A `provider_identity:` recovery exists.
    has_provider_recovery: bool,
}

/// What a row added. Every path of the TypeScript counts `checked` once.
#[derive(Default)]
struct Tally {
    removed: bool,
    failed: bool,
    errors: Vec<String>,
}

pub async fn refresh(
    state: &AppState,
    rows: Vec<SourceRow>,
    active: &[Recovery],
    deadline_ms: i64,
) -> (SocialOutcome, Observations) {
    let now = iso_at(now_ms());
    let mut seen = Observations::default();
    let mut outcome = SocialOutcome::default();
    for (index, row) in rows.iter().enumerate() {
        if now_ms() >= deadline_ms {
            // The rest keep their last_checked_at for the next run.
            outcome.deferred_by_deadline = rows.len() - index;
            break;
        }
        let attempted_at = iso_at(now_ms());
        let provider = active
            .iter()
            .find(|recovery| recovery.source_key == provider_identity_key(row));
        let context = Row {
            state,
            row,
            active,
            attempt_key: format!("refresh:{}:{attempted_at}", row.id),
            attempted_at,
            may_resolve_provider: provider.is_some_and(|recovery| recovery_matches(recovery, row)),
            has_provider_recovery: provider.is_some(),
        };
        let tally = context.check(&mut seen, &now).await;
        outcome.checked += 1;
        outcome.removed += usize::from(tally.removed);
        outcome.failed += usize::from(tally.failed);
        outcome.errors.extend(tally.errors);
    }
    (outcome, seen)
}

/// `tiktokProviderIdentityState(row, oembed)`.
#[derive(PartialEq, Eq)]
enum ProviderIdentity {
    NotApplicable,
    Inconclusive,
    Confirmed,
    Mismatch,
}

fn provider_identity(row: &SourceRow, oembed: &OEmbedResult) -> ProviderIdentity {
    if row.platform != Some(Platform::Tiktok) {
        return ProviderIdentity::NotApplicable;
    }
    match &oembed.provider_content_id {
        None => ProviderIdentity::Inconclusive,
        Some(id) if Some(id) == row.external_id.as_ref() => ProviderIdentity::Confirmed,
        Some(_) => ProviderIdentity::Mismatch,
    }
}

/// Why the TypeScript's `try` ended in its `catch`.
enum Thrown {
    /// `OEmbedError` with status 404.
    Gone,
    /// Anything else, by its message.
    Other(String),
}

const LIVE: &str = "UPDATE public.media_sources SET title = $2, channel_name = $3, embeddable = true, \
    removed_at = NULL, last_checked_at = $4::timestamptz, metadata_refreshed_at = $4::timestamptz, \
    metadata_expires_at = $5::timestamptz WHERE id = $1::uuid";

impl Row<'_> {
    fn counts<'s>(&self, seen: &'s mut Observations) -> &'s mut super::refresh::Counts {
        seen.get(self.row.platform.unwrap_or(Platform::Tiktok))
    }

    async fn check(&self, seen: &mut Observations, now: &str) -> Tally {
        let mut tally = Tally::default();
        if !identity_is_valid(self.row) {
            self.counts(seen).invalid_identity += 1;
            tally.failed = true;
            if quarantine(self.state, self.row, &self.attempted_at)
                .await
                .is_err()
            {
                tally.errors.push(format!(
                    "invalid_identity_quarantine_failed:{}",
                    self.row.id
                ));
            }
            return tally;
        }
        let mut classified = false;
        let thrown = match self.live(seen, now, &mut classified, &mut tally).await {
            Ok(()) => return tally,
            Err(thrown) => thrown,
        };
        match thrown {
            Thrown::Gone => self.gone(seen, now, classified, &mut tally).await,
            Thrown::Other(message) if self.row.external_id.is_some() => {
                if !classified {
                    self.counts(seen).inconclusive += 1;
                }
                tally.failed = true;
                if own_key_is_held(self.active, self.row) {
                    tally
                        .errors
                        .push(format!("source_recovery_identity_mismatch:{}", self.row.id));
                    return tally;
                }
                let code = if message == "source_refresh_update_failed" {
                    "db_failure"
                } else {
                    "provider_transient"
                };
                if record_own_failure(
                    self.state,
                    self.row,
                    &self.attempt_key,
                    code,
                    &self.attempted_at,
                )
                .await
                .is_err()
                {
                    tally
                        .errors
                        .push(format!("source_recovery_record_failed:{}", self.row.id));
                }
            }
            Thrown::Other(_) => tally.failed = true,
        }
        tally
    }

    /// The `try` block. `Ok` covers its own early `continue`s.
    async fn live(
        &self,
        seen: &mut Observations,
        now: &str,
        classified: &mut bool,
        tally: &mut Tally,
    ) -> Result<(), Thrown> {
        self.counts(seen).provider_submitted += 1;
        let oembed = match self.state.oembed.get(&self.row.canonical_url).await {
            Ok(oembed) => oembed,
            Err(Failure::OEmbed(error)) if error.status == 404 => return Err(Thrown::Gone),
            Err(failure) => return Err(Thrown::Other(failure.message().to_owned())),
        };
        let identity = provider_identity(self.row, &oembed);
        if matches!(
            identity,
            ProviderIdentity::Mismatch | ProviderIdentity::Inconclusive
        ) {
            self.counts(seen).inconclusive += 1;
            self.provider_identity_failed(tally).await;
            return Ok(());
        }
        // TikTok answers any ID with a bare player: no proof the post is public.
        if self.row.platform == Some(Platform::Tiktok)
            && (oembed.title.is_none() || oembed.author_name.is_none())
        {
            return Err(Thrown::Other(
                "TikTok source status is inconclusive".to_owned(),
            ));
        }
        self.counts(seen).confirmed += 1;
        *classified = true;
        self.mark_live(&oembed, now).await?;
        let confirmed = identity == ProviderIdentity::Confirmed;
        if self.resolve(confirmed).await.is_err() {
            // Already live: a ledger failure is no evidence about the source.
            tally.failed = true;
            tally.errors.push(format!(
                "social_live_recovery_resolve_failed:{}",
                self.row.id
            ));
        }
        Ok(())
    }

    /// `recordProviderIdentityFailure` for an unconfirmed TikTok identity.
    async fn provider_identity_failed(&self, tally: &mut Tally) {
        tally.failed = true;
        let preserve = self.has_provider_recovery && !self.may_resolve_provider;
        let key = provider_failure_key(self.row, preserve);
        let recorded = if can_change_key(self.active, self.row, &key) {
            record_provider_identity_failure(self.state, self.row, &self.attempted_at, &key).await
        } else {
            Err("source_recovery_identity_mismatch".to_owned())
        };
        if recorded.is_err() {
            let error = format!("provider_identity_recovery_failed:{}", self.row.id);
            tally.errors.push(error);
        }
    }

    /// The source is live: its metadata, then its posts.
    async fn mark_live(&self, oembed: &OEmbedResult, now: &str) -> Result<(), Thrown> {
        let lossy = |text: &Option<JsString>| {
            text.as_ref()
                .map(|text| String::from_utf16_lossy(text.units()))
        };
        let binds = vec![
            bind(&self.row.id),
            lossy(&oembed.title),
            lossy(&oembed.author_name),
            bind(now),
            bind(&metadata_expiry()),
        ];
        db::execute(self.state, LIVE, binds)
            .await
            .map_err(|_| Thrown::Other("source_refresh_update_failed".to_owned()))?;
        sync_availability(self.state, self.row, "live")
            .await
            .map_err(Thrown::Other)
    }

    /// The 404 branch of the `catch`: the provider no longer has the post.
    async fn gone(&self, seen: &mut Observations, now: &str, classified: bool, tally: &mut Tally) {
        if !classified {
            self.counts(seen).confirmed += 1;
        }
        // Dead content first, so a failed source write stays due.
        let written = match sync_availability(self.state, self.row, "dead").await {
            Ok(()) => mark_removed(self.state, self.row, now).await,
            Err(error) => Err(error),
        };
        if written.is_err() {
            tally.failed = true;
            tally
                .errors
                .push(format!("social_404_write_failed:{}", self.row.id));
            if self.row.external_id.is_some()
                && !own_key_is_held(self.active, self.row)
                && record_own_failure(
                    self.state,
                    self.row,
                    &self.attempt_key,
                    "db_failure",
                    &self.attempted_at,
                )
                .await
                .is_err()
            {
                tally
                    .errors
                    .push(format!("source_recovery_record_failed:{}", self.row.id));
            }
            return;
        }
        let tiktok = self.row.platform == Some(Platform::Tiktok);
        if self.resolve(tiktok).await.is_err() {
            tally.failed = true;
            tally.errors.push(format!(
                "social_404_recovery_resolve_failed:{}",
                self.row.id
            ));
            return;
        }
        tally.removed = true;
    }

    /// Resolves the provider-identity key (when `provider` and it matches)
    /// and the source's own key (when it may change it).
    async fn resolve(&self, provider: bool) -> Result<(), String> {
        let (Some(platform), Some(external_id)) =
            (self.row.platform, self.row.external_id.as_deref())
        else {
            return Ok(());
        };
        if provider && self.may_resolve_provider {
            let key = format!("{}:provider_identity", self.attempt_key);
            recovery::resolve(
                self.state,
                &provider_identity_key(self.row),
                &key,
                &self.attempted_at,
                &iso_at(now_ms()),
            )
            .await?;
        }
        let own = source_key(platform, external_id);
        if can_change_key(self.active, self.row, &own) {
            recovery::resolve(
                self.state,
                &own,
                &self.attempt_key,
                &self.attempted_at,
                &iso_at(now_ms()),
            )
            .await?;
        }
        Ok(())
    }
}
