# Loop 079 acceptance — Plus alert entitlement RLS hardening

## Problem

The application routes reject expired Plus users, but direct authenticated
PostgREST reads of `trend_alerts` and `plus_saved_context_alerts` only enforce
owner identity. An expired subscriber could therefore read old private Plus
alert rows by bypassing Next.js.

## Scope

- Add one forward migration; do not rewrite historical migrations.
- Require both `user_id = auth.uid()` and `has_active_plus(auth.uid())` for
  direct authenticated SELECT on both private Plus alert tables.
- Preserve service-role fan-out, operator/server loaders, and the existing
  owner-scoped read-marking RPCs.
- Add source-contract regression tests for active, expired, and cross-owner
  boundaries without connecting to or changing a database.

## Acceptance criteria

1. `trend_alerts` self-read policy requires owner identity and active Plus.
2. `plus_saved_context_alerts` self-read policy requires owner identity and
   active Plus.
3. No INSERT/UPDATE/DELETE table grant is added for browser roles, and the
   existing service-role/operator/server flows remain unchanged.
4. The migration is forward-only and idempotent (`drop policy if exists` then
   recreate); no production migration is executed in this loop.
5. Static policy tests cover active Plus, expired Plus, and another user, and
   the existing full test/type/lint/build gates pass.

## Stop boundary

This loop ends after local source-contract and build verification. Live
PostgREST requests with active/expired JWTs and production migration remain
external operational gates.
