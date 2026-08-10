# Loop 111 acceptance — global detail to Plus Use Kit activation

## Target

Make the existing localized meme detail feel immediately useful to a Plus
subscriber. After reading a global detail, an active Plus user must have a
clear “use this now” entry into the existing Use Kit, can share or copy the
reviewed localized output, and receives a session-only prepared confirmation.

## Acceptance criteria

- Add a prominent detail-page entry to `#meme-use-kit-title`. Active Plus users
  enter the existing active Use Kit; free and signed-out users reach the
  existing locked panel and its locale-safe pricing gate, with no false
  Plus-ready state.
- Keep the Use Kit source-only: it may use only the localized reviewed facts
  already rendered by the detail page. Do not add AI generation, Korean
  fallback, persistence, receipt writes, or new API/DB/RPC/schema surfaces.
- Support copy-all, per-format copy, and client-side share/fallback. A
  successful copy or share changes the current session to `prepared` and
  exposes an accessible status; a reload resets that state.
- Preserve existing Save, translation-priority, export, canonical, metadata,
  safety, lifecycle, and locked/free boundaries.
- Provide copy for `ko`, `en`, `ja`, `zh`, and `zh-tw` through the existing
  fallback contract, with no private fields or analytics payload expansion.
- Cover active/free/signed-out SSR, entry link, copy success/failure, share
  fallback/cancel, prepared state, and reload-reset behavior with regression
  tests.

## Verification shape

- Run the focused Use Kit/detail tests, then the full test suite, TypeScript,
  lint, production build, diff check, and a local production browser smoke of
  a localized detail route.
- Production payment, authenticated RLS, Supabase migration/write,
  translation publication, OpenAI calls, deploy, push, and merge remain
  outside this loop's authority boundary.
