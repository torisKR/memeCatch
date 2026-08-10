# Loop 108 acceptance — Plus demand / translation supply alignment

## Target

Give the operator one deterministic, report-only view that aligns active Plus
translation demand with the existing human translation intake gate.

## Acceptance criteria

- Accept the existing intake report as the supply snapshot. Preserve its
  source-locked, worklist, duplicate, stale, and four-locale gate results;
  do not regenerate or mutate translation artifacts.
- Accept an operator-safe aggregated Plus demand export. The report may contain
  meme/locale demand counts and public revision fields, but must not require or
  emit owner IDs, private notes, or translation content.
- Classify each active demand row fail-closed as `missing`, `stale`,
  `review_needed`, `ready`, or `unknown` using the exact locale and source
  revision. Rank missing/stale/review-needed supply before ready rows, then by
  request count and deterministic tie-breakers.
- Emit, for all `en`, `ja`, `zh`, and `zh-tw`, intake missing-before,
  missing-after, delta, active request count, active meme count, and actionable
  request count, plus a deterministic priority list.
- Reject malformed locale, count, timestamp, revision, or duplicate demand
  rows. A failed intake gate must remain failed in the combined report.
- The command is read-only: no Supabase client, SQL execution, OpenAI call,
  translation artifact generation, insert, review, or publication.

## Verification shape

- Unit/contract tests cover ordering, all supply states, locale summaries,
  intake failure propagation, duplicate rejection, and private-field absence.
- Run the report against a small local fixture and inspect JSON output.
- Run the focused tests, full test suite, TypeScript, lint, build, and diff
  checks. Production and authenticated operator QA remain outside this loop's
  authority boundary.
