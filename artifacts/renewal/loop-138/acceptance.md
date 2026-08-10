# Loop 138 Acceptance — PLUS-053 Premium First-Session Global Starter

## Target

Let an active Plus subscriber consume the existing verified Global Daily session directly from Premium and continue into the existing meme Use Kit.

## Acceptance criteria

- Premium loads the existing `loadGlobalDailyChallenge()` path only for active Plus.
- The existing `GlobalDailyChallenge` renders after Action Inbox/Outcome Snapshot and before lower-priority history/feed modules.
- Ready state exposes the same three-question start, answer, completion, and streak flow.
- Completed state keeps the existing first-meme `#meme-use-kit-title` handoff.
- Unavailable state remains explicit and does not become an empty or fake-success state.
- The standalone `/daily` route and its scoring/completion API contract remain unchanged.
- When the embedded challenge is supplied, the old Premium `/daily` entry card is not duplicated; when it is not supplied, the prior entry fallback remains available.
- No new DB/API/RPC/schema/migration/write/AI/publication/deploy path is introduced.

## Scope

Changed: Premium Global Daily loader wiring, Dashboard placement/fallback, and Dashboard regression coverage.

Not proven in this loop: authenticated Plus/RLS schedule and translation supply, production completion write, human translation publication, live route supply, or production deployment.
