# Operator media classification: local implementation, not production activation

## Gap and scope

The 12-row editorial proposal separates five video-demonstration priorities,
four context-only media options, and three identity-conflict holds. It is not
operator approval. The existing editor could change `category` but not the
persisted parent `media_type`, so an operator had no normal editor path for
correcting a video-based meme stored as `image` or `text`.

This change extends that existing path, not a new approval system. No row was
classified, source approved, video uploaded, or production deployment performed.
The actual candidate raw-metadata request remains disabled pending scoped approval.

## Changed files and flow

- `components/admin/constants.tsx`: existing enum-compatible five media options.
- `components/admin/meme-edit-form.tsx` and its test: disabled by default; operator
  chooses a classification and explicitly saves when enabled. AI draft generation
  does not change classification, save, approve, or publish.
- `app/(default)/admin/memes/[id]/page.tsx`: passes the actual stored media type
  and server-derived exact-true feature flag.
- `lib/actions/admin.ts` and `admin-house-original.test.ts`: optional validated
  field, gated server-side, existing session/operator check and single RPC only.
- `.env.example`: `ADMIN_MEDIA_CLASSIFICATION_ENABLED=false`.
- `supabase/migrations/20261013215325_operator_meme_media_classification.sql`:
  CLI-generated migration name; replaces the existing same-signature RPC only.
  Locks the parent, preserves omitted media type, validates explicit JSON/enum,
  keeps safety changes queued, audits actual old/new type in the same transaction.
- `supabase/operator_meme_media_classification.test.ts`: local SQL contract checks.
- `scripts/operator-media-classification.runtime.test.mjs`: disposable real
  PostgreSQL fixture, Unix socket only, no app credentials or external connections.

Flow: server flag → existing operator form → explicit save → existing authenticated
server action → existing `update_meme_with_safety_review` RPC → one parent and
audit entry → existing canonical/locale cache invalidation. Source/content rows,
rights review, source availability, Life signal and safety semantics remain separate.

## Fresh checks

- Focused editor/action/SQL contracts plus existing embed, JSON-LD and source
  recovery regressions: **10 test files, 142 tests passed**.
- Disposable PostgreSQL: **25 SQL assertions passed**. Covers all five enums,
  legacy omission, invalid/null/non-string values, denied nonoperator/null actor,
  denied anon EXECUTE, unchanged pending/private sources, safety queued rather than
  applied, audit-failure rollback, and the actual house-original copy guard.
- Targeted ESLint passed; script checked explicitly with `--no-ignore`.
- `pnpm exec tsc --noEmit`, `node --check` and `git diff --check` passed.
- Independent code-review lane found no actionable defect; its fresh focused
  tests passed 26/26 with typecheck, targeted lint and diff check. This is scoped
  code approval, not human semantic/rights approval for any meme or video.
- The first sandboxed `initdb` was denied shared-memory access; rerun with approved
  local execution succeeded. Both successful temporary databases were stopped;
  diagnostics retained in OS temporary directories.

This fixture does not simulate all Supabase RLS policies, application triggers,
deployed migration ordering or concurrency. No authenticated browser save against
a full local Supabase stack or production was attempted. No production canary or
real embed playback is established by these tests.

## Browser candidate evidence

`artifacts/release/20261014-media-recovery/classification-candidate-watch-observations-20261014.json`
preserves a recovered same-session browser result, not a fresh playback claim.
BLACKPINK showed only an advertisement; ETA showed an initial practice frame;
Wednesday showed initial autoplay and then the play button after pausing. None
establishes time/frame progression or catchmeme iframe playback. Screenshots for
ETA and Wednesday still exist at the recorded local paths. No origin, rights,
API-public/embeddable or independent-spread approval is inferred.

## Activation, budget and rollback

There is **no new scheduler, provider call, paid dependency or AI request** in this
editor change. The flag stays unset/false in runtime environments; changing
`.env.example` alone does not activate it.

For a separately approved rollout, first test the migration with the full local
stack and its triggers, then inspect deployed RPC drift and apply only this
reviewed migration. Enable `ADMIN_MEDIA_CLASSIFICATION_ENABLED=true` only after
the target database supports the new key. Old RPCs ignore unknown JSON keys, so
enabling first would falsely appear to save classification. Do not enable from
this document or automatically change the 12 parents.

For rollback, disable the flag and redeploy only the reviewed editor/action files.
Legacy callers omit `media_type` and retain their previous behavior; the compatible
RPC may remain installed. A separately reviewed function rollback can restore the
previous RPC body without erasing audit history or parent/source data. Never
revert classifications in bulk or drop tables as rollback.

Independent next approval gates: a bounded raw `videos.list` metadata check for
the concrete candidate IDs; then per-item semantic, rights, public/embeddable and
actual iframe-playback review. Collection is not approval, and classification is
not publication.

The implementation follows the existing RPC permissions and operator boundary;
see [Supabase database-function guidance](https://supabase.com/docs/guides/database/functions).
