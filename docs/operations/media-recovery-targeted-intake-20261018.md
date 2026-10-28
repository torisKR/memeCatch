# Missing-media recovery continuation — 2026-10-18

## Scope and outcome

This continuation makes two local recovery paths usable without changing public
content automatically: an exact old-meme target for the existing operator intake
form, and reconciliation of the tested stale-source eligibility fix from the
recovery branch into the dirty root checkout. Existing edits were preserved.
Independent native Codex agents owned the two non-overlapping implementation lanes.

This is not completion of the production recovery goal. Twenty documents in the
explicit cohort below still lack an approved live video/embed child. The initial
local phase made no production changes. After the user's subsequent explicit
approval, only the two migrations and one guarded existing-source canary described
below were executed. No new source approval, upload, deployment, commit, merge, or
push occurred.

## Fresh production evidence

See `artifacts/release/20261018-media-recovery/production-readonly-recheck.json`.

- At `2026-10-18T09:59:51.585624Z`, the read-only database query selected documents
  with `doc_class=meme`, `category<>phrase`, moderation `approved/limited`, a
  non-null publication timestamp, and `media_type=video`: 1,195 documents, of which
  20 have no approved `live` video/embed child. This exact cohort is not presented
  as a change from earlier broader counts or as a full playback audit.
- The operator channel candidate `PRHgGhd7nW8` remains pending. Stored public and
  embeddable fields were read; no fresh YouTube verification or approval occurred.
- At the initial read, `list_source_refresh_candidates` was absent in production.
  Both approved migrations were subsequently applied as recorded below. The
  previous failed canary reports are preserved.
- Three public detail GETs (`xt52qg4j`, `ug9w5jek`, `89b37mrx`) returned 200 with
  `x-memecatch-release-sha: media-recovery-b454fc29a8fc`. The unavailable video ID
  `YNOBV_uVzeY` and pending `PRHgGhd7nW8` were absent from their respective HTML.
  Neither checked spelling of the old draft-document phrase appeared. No iframe
  playback or client/mobile behavior was tested by these HTTP checks.
- The produced-video view still has its old public/unlisted predicate but zero
  returned rows. This is a separate latent exposure issue with its own unapplied
  public-only migration; it is not evidence of a live exposure or source recovery.

## Changed files

### Exact operator intake target

- `app/(default)/admin/sources/page.tsx`
- `app/(default)/admin/sources/page.test.tsx`
- `components/admin/source-ingestion-form.tsx`
- `components/admin/source-ingestion-form.test.tsx`
- `app/(default)/admin/memes/[id]/page.tsx` — only the targeted intake link was added;
  unrelated existing changes in this file remain intact.
- `app/(default)/admin/memes/[id]/page.test.tsx`
- `lib/safe-redirect.ts` and `lib/safe-redirect.test.ts`
- `proxy.test.ts` — only targeted authentication-return regressions were added;
  unrelated concurrent canonical-redirect changes were preserved.

The latest-200 dropdown is retained. An operator can additionally enter from an
individual meme's edit page. Only a scalar UUID `memeId` is accepted; if it is not
in the recent list, the authenticated operator client performs one exact lookup.
The returned identity must match. Invalid, missing, mismatched and failed lookups
show feedback rather than silently selecting another meme. No provider collection
or submission happens on navigation. A stable form key preserves operator input
on same-target refresh; a different server target receives a different key.
An independent review caught login-return target loss and uppercase UUID mismatch;
both were fixed. Only `/admin/sources` can retain one validated, lowercase UUID
`memeId` during authentication. Duplicate/invalid values and other routes do not
gain that allowance. Real page/form rendering and the edit-page link are tested.

### Stale-source eligibility reconciliation

- `lib/sources/refresh.server.ts`
- `lib/sources/refresh.server.test.ts`
- `supabase/migrations/20261013195628_source_refresh_eligibility.sql`
- `supabase/source_refresh_eligibility_contract.test.ts`
- `scripts/source-refresh-eligibility.runtime.test.sh`

The migration and contract originate from the existing recovery worktree, not a
new parallel schema. Ordinary stale selection excludes unresolved recovery rows
in SQL before ordering/limiting, so a prefix of blocked rows cannot starve other
eligible sources. RPC absence/error fails closed with no broad-query fallback.
The exact-source canary path and due/backoff/circuit-open logic remain unchanged.
The local PostgreSQL fixture is Unix-socket-only; cleanup validates the task's
mktemp path prefix before removal.

## Data flow and limits

```text
operator meme edit → targeted source-review page → explicit URL submission
→ existing normalization/deduplication → pending candidate → operator review
→ existing atomic publication boundary (explicit operator action only)

scheduled refresh (still not activated here) → service-only eligibility RPC
→ existing bounded provider checks → existing availability/recovery handling
```

The atomic-publication repair in the diagram was initially unapplied; its
installation below does not itself run any approval or create any projection.

No new environment variables, dependencies, tables, external services, schedule,
or API quota allocation were introduced. Existing `SOURCE_REFRESH_ENABLED`,
`SOURCE_REVIEW_ATOMIC_ENABLED`, project-bound Supabase configuration and provider
configuration remain the relevant gates. The eligibility RPC caps a requested
batch at 100; existing caller limits, run deadline and retry budgets remain in
place. Tests explicitly clear both existing canary sentinels so the live canary
test cannot run accidentally.

## Verification

- Focused intake/refresh/recovery/route/canary/SQL tests: **10 files passed,
  103 passed, 1 skipped**. The skipped case is the actual live canary, not a pass.
- After the authentication-return review fixes, an intermediate targeted run
  passed **12 files, 196 tests, 1 skipped**. This overlaps the earlier selections;
  do not add these totals together. Independent review approved the exact-target
  lane after its own 119-test subset and fresh typecheck/lint checks.
- Isolated PostgreSQL runtime: `RUNTIME_SOURCE_REFRESH_ELIGIBILITY_OK`; verifies
  selection after 1,001 unresolved rows, service-role-only permissions and rollback.
- Targeted ESLint, `bash -n`, JSON parsing and whitespace checks: passed.
- Fresh parent `pnpm exec tsc --noEmit`: passed. An earlier child run observed
  transient unrelated missing files/type errors during concurrent work; the fresh
  rerun supersedes that typecheck failure only.
- An initial public-media/copy selection passed 8 files/60 tests. A later combined
  selection had **160 passed, 3 failed, 1 skipped across 18 files**. The three
  failures are old heading-copy expectations in `components/safety-rationale.test.tsx`
  after a separate edit to `components/safety-rationale.tsx` during this run.
  Neither file was changed by these two implementation lanes. The failing result
  is retained as historical evidence. The separate copy lane subsequently updated
  its expectations; a fresh single-file rerun passed all 9 tests.
- The final combined intake/refresh/recovery/auth/public-media/copy/SQL selection
  passed **22 files, 267 tests, 1 skipped (268 total)**. Both live-canary sentinels
  were explicitly cleared for this run; the skipped test is the live operation,
  which was executed separately under the exact approval below. This fresh run
  supersedes the three historical copy-expectation failures. These overlapping
  totals must not be added together and do not establish a deployed web release.
- No full build, new release assembly, cloud build, browser/admin authorization
  session or actual iframe playback was validated here. The later approved live
  canary is reported separately below rather than counted as the skipped case.

## Approved operating changes and exact canary

The user explicitly approved the two source-recovery migrations and one additional
existing-source canary during this continuation. The preflight verified that both
new functions were absent, the original review function body matched the tested
local body after trimming, and the exact canary target remained due/unresolved.

Applied with the existing linked Supabase project only:

| Local migration | Remote version / name |
| --- | --- |
| `20261013195628_source_refresh_eligibility.sql` | `20261018100604` / `source_refresh_eligibility_20261018` |
| `20261014123000_atomic_source_review_projection_repair.sql` | `20261018100614` / `atomic_source_review_projection_repair_20261018` |

Fresh post-application reads confirm both history entries and privileges: the
eligibility RPC is invoker-mode, service-role-only; anonymous execution of review
is denied; the preserved v1 function cannot be invoked by authenticated callers.
The wrapper retains its runtime operator check. A read-only limit-1 eligibility
smoke returned one row without a provider request.

The MCP assigns remote timestamps when applying local SQL. The exact local-to-remote
mapping and source hashes are retained in the activation artifact. Do not run a
blanket `supabase db push` against the dirty checkout: reconcile migration history
first, or timestamp-mismatched historical files could be submitted again.

The newly authorized canary ran once for existing source
`cbbfcba5-c980-4b49-b536-19b3a1057282` / video `hYqE_mlPeHc`. It passed one live
test; nine guard tests were skipped by the test-name filter, not failed. Request
guards record exactly one `videos.list`, one source metadata write, two exact
identity/alias availability patches, one recovery resolution and one job audit.
There were zero oEmbed calls, recovery failure writes, new candidates or approvals.
An independent DB read confirms `resolved_at=2026-10-18T10:06:44.694Z`, no next
retry, public/embeddable metadata refreshed, and the same one existing live child.
It did **not** restore one of the twenty missing children or prove iframe playback.
The additional one-canary allowance is now consumed. Do not rerun it automatically
or reset its resolved record to make the old preconditions pass.

Evidence:

- `artifacts/release/20261014-media-recovery/source-refresh-canary-20261018100643892-v0xwy7ft.json`
- `artifacts/release/20261018-media-recovery/approved-db-activation-and-canary.json`

Earlier failures were not overwritten. The first report-location lookup sorted a
legacy `*-report.json` filename after timestamped reports; it was corrected by
sorting parsed `executedAt`. No canary was rerun to locate the report.

Security advisors before/after contain the same seven findings, including one
pre-existing ERROR; there are no newly added/removed finding identities. This is
not an all-clear security verdict. The operator-channel candidate remains
pending/unknown-rights. No global refresh activation or web deployment occurred.

Unchanged advisor remediation references (outside this source-recovery change):

- [RLS enabled without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Security-definer view](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view)
- [Mutable function search path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- [Extension in public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)
- [Anonymous executable security-definer function](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)
- [Authenticated executable security-definer function](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

## Rollback and next gates

The new local code changes are uncommitted. Revert only the reviewed intake hunks and
eligibility integration with a targeted reverse patch if needed; do not reset,
stash, delete or overwrite the dirty checkout or other agents' work. The restored
eligibility migration and projection-repair migration are now applied remotely.
Leave the unused eligibility RPC in place if refresh must stay disabled. Any
review-function rollback needs a separately reviewed forward migration restoring
the verified original public function body; do not drop functions, reverse other
migrations or delete content automatically. Do not undo a successful canary by
restoring stale metadata or reopening its resolved failure record.

Before any new web release, freeze an explicit allowlist over the verified
production baseline and repeat tests against that frozen tree, because parallel
work remains in the checkout. The observed copy/test conflict is resolved by the
fresh combined run above. Repeat
the required local/mobile/reduced-motion/console checks. Do not accidentally add
produced-video integration, Paddle work or unrelated homepage changes to that
release. Source replacement still needs exact identity, semantic fit, policy,
rights, current public/embed status, actual playback and operator review. A high
missing count or green local tests are not substitutes for those checks.
