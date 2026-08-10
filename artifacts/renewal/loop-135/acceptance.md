# Loop 135 Acceptance — PLUS-051 Outcome Rating Reopen

## Selected vertical

Close the Plus feedback loop for existing Outcome History rows. An unrated receipt should offer a direct
rating action, persist through the existing authenticated rating path, and refresh the first-screen Snapshot
so the subscriber can see that the record has become useful feedback for the next recommendation.

## Acceptance criteria

- A ready History row with `performanceRating === null` shows the five-locale `Rate this use` CTA and no CTA
  is shown for already-rated rows.
- The CTA opens only `hit`, `neutral`, and `miss` choices and posts to the existing
  `/api/plus/outcome-ledger/rating` route with the opaque owner-scoped `receiptId`.
- The client accepts a save only when the response has `updated: true`, the same `receiptId`, and the selected
  `performanceRating`. A failed response leaves the row unrated and reports an error.
- A successful save immediately updates the visible row and calls `router.refresh()` so the server-derived
  Outcome Snapshot can re-read its rating count.
- Existing result URL safety, localized/Korean fallback links, hit replay behavior, and private-field
  non-disclosure remain unchanged.
- Locked, empty, and unavailable History states do not expose a rating CTA.
- No new DB table, migration, RPC, API route, analytics event, OpenAI call, automatic publication, or
  production write is introduced.

## Explicit non-claims

This local vertical does not prove an authenticated Plus account, RLS behavior, a real rating POST, an external
platform result, reviewed translation supply, live global route deployment, or production publication.

