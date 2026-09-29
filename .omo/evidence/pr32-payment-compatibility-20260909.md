# PR 32 payment compatibility finding

Scope: read-only source review of 6d9bb273fdc9869e14d7107f8ede2774dcb3b02e. No production transactions, migrations or PR changes performed.

## Delayed payment reconciliation risk

The new create_fairy_billing_intent deletes same-user intents after 30 minutes when no local fairy_payments row references them. That absence does not prove an external payment has not completed: its webhook may still be delayed.

Sequence requiring a regression test:

1. Create intent A and complete payment at the provider while A exists.
2. Delay webhook delivery beyond A's 30-minute lifetime.
3. Request another checkout. PR SQL removes A before creating/reusing B.
4. Deliver the original signed payment event referencing A.

The current process_fairy_payment requires A to exist and raises unknown_intent when it does not. fairy-handlers maps processing errors to HTTP 503. Its timestamp check rejects future events but permits delayed past events, so the intended transport contract allows the sequence above. The repository has no alternate reconciliation lookup in this path.

This is a source-supported failure path, not a dynamically reproduced or observed production incident. Existing 34-test SQL suite covers repeated live checkout, consumed intents, duplicate payment, provider coexistence and refunds, but not expiry plus delayed delivery.

Before merging: settle a provider-compatible retention/reconciliation contract; do not solve the record-growth problem by deleting an outstanding reconciliation key. Add the delayed-delivery regression and verify idempotency and growth bounds together. Do not simply remove all bounds or reuse consumed IDs.

## Validation environment

Docker initially failed because /Users/toris/.orbstack/run/docker.sock was absent. Requested launch of the existing OrbStack app; must recheck daemon and local database state before testing. No live test process is asserted by an application-launch result alone.

## Goal status

Previous goal turn: progress (main sync and branch classification). This turn: progress (new compatibility evidence changes PR merge decision). Frontend approach decision remains unanswered; design implementation has not started. Full goal remains active.
# Runtime reproduction update

Local PostgreSQL reproduction succeeded on 2026-09-09 against PR32 SHA
`6d9bb273fdc9869e14d7107f8ede2774dcb3b02e`.
Loaded the actual Fairy foundation and PR32 migration into one local transaction,
then ran `pr32-delayed-payment-repro.sql`. PostgreSQL emitted
`REPRODUCED: valid delayed payment loses reconciliation key after checkout retry`
and completed `ROLLBACK` with exit code 0. No production writes occurred.
This proves the SQL reconciliation failure, not an actual provider incident.
PR32 must not be merged unchanged. The full integration/content/design goal remains incomplete.
# Approved fix verification

User approved outstanding-intent reuse. Applied local changes in
`/tmp/memecatch-pr32-fix`: removed expired-row deletion and expiry-based exclusion
from `create_fairy_billing_intent`. Owner/project/minimum matching, account lock,
service-role grants and consumed-intent exclusion remain unchanged.

Expanded existing pgTAP suite from 34 to 38 assertions. Actual local PostgreSQL
execution passed all 38 and rolled back. Running the same expanded suite against
the original HEAD migration failed assertion 35 and raised `unknown_intent`
(exit 3), demonstrating regression sensitivity. `git diff --check` passed.
Editor LSP could not access the separate worktree; database execution supplied
SQL parsing and runtime validation instead. No TypeScript/application build or
provider E2E was run in this slice. Changes remain uncommitted, not merged and
not deployed. Main integration, content validation and redesign remain open.
