# Source refresh observability

Completed `refresh_media_sources` job records include `detail.observations` for
`youtube`, `youtube_shorts`, `instagram`, and `tiktok`. Each number counts
source rows in that run, not unique videos over multiple runs:

- `selected`: source rows selected after recovery filtering and platform limits.
- `provider_submitted`: valid-identity rows passed to the provider function.
  YouTube is submitted in one call which internally sends sequential batches;
  this number does not prove that every ID reached an HTTP request. Social
  results may come from the existing oEmbed cache.
- `confirmed`: the current provider policy produced a usable live, unavailable,
  hidden, or region-restricted result. It is a provider classification, not a
  guarantee of actual playback, the precise reason for unavailability, a
  successful database write, or a completed cache invalidation.
- `inconclusive`: the submitted rows for which the provider returned ambiguous
  data, failed, or for which the whole YouTube fetch failed. A TikTok generic
  player remains inconclusive even when its embedded ID matches the request.
- `invalid_identity`: selected rows rejected before provider submission.

`selected` can exceed the other outcome counts if processing aborts early.
Failures and incomplete writes remain visible in the existing `status`,
`youtube`, and `oembed` fields. The counters do not replace the recovery ledger.
For new completed records, `started_at` is captured on entering the refresh
function and `finished_at` immediately before the audit insert. Existing records
retain their original timestamps. A process crash, early selection error, or
failed audit insert can still leave no job record; monitor the scheduler too.

`detail.recovery_unmatched_due_keys` counts due recovery keys examined during
the run that did not match the current source platform and identity, including
missing sources and keys whose identity could not be verified. Duplicate keys
from the due and active snapshots count once. They do not consume retry slots
and are not automatically resolved or modified. A future or non-retryable key
for a source continues to defer that source, including when its identity is old.
This count only covers due keys in source batches actually examined: batches
are skipped once their platforms' retry slots are full. It is not a total of all
stale ledger entries.

Stale sources are selected with one query per platform group (YouTube and
Shorts, TikTok, Instagram), in `last_checked_at, id` order, reading the group's
limit plus 50 rows of headroom, with a 10 s timeout. There is no OFFSET paging.
The query excludes sources whose ID has an unowned platform-and-ID recovery key
(no source id, or a recorded external id that differs from the key); every such
source would fail the identity check and, never refreshed, would hold the oldest
positions. The exclusion is a flat `or` group, because the database plan client
parses only flat groups. Rows without an external id are never excluded, so
invalid identities still reach quarantine. A second source that shares an owned
key's ID is not excluded in the query; the in-memory identity check skips it and
the headroom rows cover it. Within the YouTube group the exclusion is by ID
across both platforms, so a Shorts row that shares an ID with an unowned YouTube
key is also held back.
`detail.recovery_unowned_keys` counts the unowned keys behind those exclusions.
Their ledger rows are neither rewritten nor resolved and need separate repair.
`detail.recovery_conflicting_stale_sources` counts rows the query returned that
the in-memory identity check still skipped; it should normally be 0, and it can
be nonzero while the job status is `ok`.

A failed or timed-out stale lookup skips only that group: the other groups still
run and the job is `partial` with `source_stale_lookup_failed:<group>`. If a
later due-source batch fails, already examined due candidates and the stale
candidates still run; the job is `partial` with
`source_recovery_candidate_lookup_failed`. Unexamined candidates are not
resolved or otherwise changed by the failed lookup.

YouTube, TikTok and Instagram run side by side. The TikTok and Instagram workers
start no new source after 40 s from job start (an oEmbed request can still take
up to 8 s), leaving the rest untouched for the next run;
`detail.oembed.deferred_by_deadline` counts them and the job is `partial`.
For TikTok, a `provider_identity:<source-id>` key is resolved only when the
active snapshot's platform and external ID match the checked source. If an
inconclusive result finds that key belongs to a different identity, its failure
is recorded under the current platform-and-ID key instead if that key also
matches. All platform-and-ID keys with mismatched identity in the active
snapshot are protected from both resolution and failure-record overwrites. This snapshot check
does not protect against identity changes after the snapshot; the existing
non-atomic refresh and cache-coherence limitations still apply.

For a read-only snapshot of stale sources, including deferred and quarantined
rows, an operator can run:

```sql
SELECT platform, count(*) AS total,
       count(*) FILTER (WHERE last_checked_at IS NULL
         OR last_checked_at < now() - interval '24 hours') AS stale,
       count(*) FILTER (WHERE last_checked_at IS NULL) AS never_checked
FROM public.media_sources
WHERE platform IN ('youtube', 'youtube_shorts', 'instagram', 'tiktok')
GROUP BY platform ORDER BY platform;
```

The snapshot is not saved per run; this avoids adding a full-table count to the
cron. Run-level observations are available from `job_runs.detail`; older rows
will not have the new fields. These changes need application deployment but no
schema migration. They do not solve source-update atomicity or the separate
post-commit cache-coherence issue.
