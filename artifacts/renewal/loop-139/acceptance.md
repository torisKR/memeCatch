# Loop 139 Acceptance — PLUS-054 Premium Global Market Passport Handoff

Date: 2026-08-10 (Asia/Seoul)

## Target

Let an active Plus subscriber finish the existing Global Daily session, understand where the first meme travels,
and then continue into the existing Use Kit without inventing a second global content system.

## Acceptance criteria

- Premium reads the existing `getMemeMarketPassport()` contract only when the account is active Plus and the loaded
  Global Daily is `ready` or `completed` with a first-question source ID.
- Global Daily question metadata preserves an optional source `id`; ordinary quiz callers remain compatible because
  the field is optional and Premium skips Passport lookup when it is absent.
- The existing `MemeMarketPassport` renders inside the completion panel only after a successful completion or when
  the server reports the challenge already completed.
- The Passport shows only reviewed market profiles, local usage/caution, and reviewed variants through its
  fail-safe loader; synthetic KR/ko origin data is not exposed as reviewed market data. Existing detail pages keep
  the same component contract while empty/partial data no longer creates a synthetic profile card.
- The existing first-question `#meme-use-kit-title` handoff remains available after the Passport context.
- Ready, signed-out, locked, unavailable, free/non-Premium, standalone `/daily`, completion POST, and streak
  contracts remain unchanged.
- No new DB/API/RPC/schema/migration/write/AI/publication/deploy path is introduced.

## Scope

Changed: Premium Passport read/wiring, optional quiz metadata, completion-panel rendering, and regression coverage.

Not proven in this loop: authenticated Plus/RLS schedule and Passport rows, production completion write, human
translation publication, live global route supply, or production deployment.
