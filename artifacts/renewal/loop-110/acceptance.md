# Loop 110 acceptance — global translation request handoff

## Target

Close the global Plus translation loop after a subscriber requests a reviewed
translation from a localized meme detail page. A confirmed queued or in-review
request must expose a direct, locale-safe link to the existing Plus request
desk so the subscriber can track fulfillment and reopen the reviewed page later.

## Acceptance criteria

- Keep the existing reviewed/current, save-required, free, signed-out, API, and
  RLS gates unchanged. The new link must never imply that a translation is
  ready before the existing status says so.
- Render the tracking link only for confirmed `requested` or `in_review`
  states, including immediately after a successful request response.
- Link to the existing `/premium#plus-translation-fulfillment-title` surface;
  do not invent a localized `/en|ja|zh|zh-tw/premium` route or add a new API,
  table, RPC, migration, or publication path.
- Provide the tracking label for `ko`, `en`, `ja`, `zh`, and `zh-tw` through
  the existing locale fallback contract. Do not expose owner IDs, request IDs,
  source URLs, private notes, or translation text.
- Preserve current-detail behavior: a current reviewed translation shows the
  available state without a request link, and the initial pending/unknown state
  does not claim that tracking is available.

## Verification shape

- Render the static states for current, initial, requested, and in-review
  branches and exercise the successful request transition in jsdom.
- Run focused translation-priority/routing/API tests, then the full test suite,
  TypeScript, lint, build, and diff checks.
- Production payment, authenticated RLS, human translation review/publication,
  and deployment remain outside this loop's authority boundary.
