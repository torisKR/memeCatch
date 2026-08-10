# Loop 134 Acceptance — PLUS-050 Outcome Proof Snapshot

## Selected vertical

Expose the count of saved result URLs already present in the owner-scoped Plus Outcome History on the first-screen Outcome Snapshot, then link to the existing History section when the count is positive.

## Acceptance criteria

- The Premium RSC derives only a count from the existing ready `PlusOutcomeHistory` DTO.
- The Snapshot renders a five-locale `saved results` metric without receiving URL values, receipt IDs, private notes, or any new persistence fields.
- A History anchor is rendered only when the count is greater than zero.
- Empty History may show an explicit zero count without a link; locked and unavailable History must close the Snapshot fail-closed rather than showing a fabricated zero.
- No new DB/API/RPC/schema/migration/write/analytics/OpenAI/publication behavior is introduced.

## Explicit non-claims

This local vertical does not prove an authenticated Plus account, RLS behavior, a real result URL, external platform publication, translation publication, or production deployment.
