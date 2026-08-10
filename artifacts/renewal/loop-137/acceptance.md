# Loop 137 Acceptance — PLUS-052 First Outcome Activation Reliability

## Target

Keep the existing Plus first-value vertical usable when a supported UI locale has no exact-current reviewed translation.

## Acceptance criteria

- `ko` and `en` keep their existing content lanes.
- For `ja`, `zh`, and `zh-tw`, English fallback is queried only when the requested reviewed/current deck produces zero eligible cards.
- Fallback candidates still pass the existing public, safe, content-depth, lifecycle, and exact source-revision gates in `buildPlusGlobalScoutDeck`.
- Fallback candidates retain `locale="en"`; Scout and Action Inbox resolve the English detail route instead of manufacturing a localized URL.
- Scout and the first One-Cut card disclose the actual content language.
- Requested-locale read errors remain `unavailable`; fallback never converts an error into an empty or active state.
- No new DB/API/RPC/schema/migration/write/analytics/OpenAI/publication/deploy path is introduced.

## Scope

Changed: `loadPlusGlobalScout`, Scout URL/disclosure rendering, Action Inbox language disclosure, four base Premium copy locales, and regression tests.

Not proven in this loop: authenticated Plus/RLS, production translation rows, external posting, live route supply, or production deployment.
