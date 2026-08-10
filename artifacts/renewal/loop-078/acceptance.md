# Loop 078 acceptance — PLUS-014 Reviewed Translation Fulfillment Center

## Problem

The existing Plus translation request button can create a request and the admin
translation queue can claim it, but the subscriber has no owner-scoped place to
see all requests, their current state, or the exact locale page to reopen after
human review. Global locale coverage therefore depends on a hidden operator
handoff rather than a closed subscriber workflow.

## Scope

- Add one Plus-only, server-rendered translation fulfillment center to `/premium`.
- Reuse `plus_translation_requests`, the existing request RPC, the existing
  operator claim/CAS review flow, and the existing exact-locale meme routes.
- Show `requested`, `in_review`, `completed`, and `dismissed` rows with request,
  update, and completion timestamps where available.
- Mark a completed request as ready only when its exact-locale translation is
  still `reviewed` and `source_updated_at === memes.updated_at`.
- Keep free, signed-out, and expired Plus users from querying or receiving the
  fulfillment DTO; preserve the owner filter in the server query and migration
  RLS policy.
- Keep the component read-only: no new request endpoint, client-side DB query,
  AI generation, auto-publish, production write, or migration execution.

## Acceptance criteria

1. Active Plus users see at most 20 owner-scoped requests on `/premium`; free
   rendering performs zero fulfillment-table queries and receives no fulfillment
   ReactNode/DTO.
2. Each row identifies the meme, requested locale, status, last update, and an
   exact locale detail link. A completed row is labelled ready only for a
   reviewed/current translation; a stale completion is explicitly labelled for
   recheck rather than presented as ready.
3. Query failure renders an unavailable state and does not masquerade as an
   empty queue. A successful zero-row result renders a distinct empty state.
4. The existing admin queue remains the only claim surface; the existing CAS
   review path and human-reviewed publication gate remain unchanged.
5. `plus_translation_requests` self-read RLS requires both owner identity and
   active Plus; operator read/update policies remain available for the admin
   queue.
6. Korean, English, Japanese, and Simplified Chinese copy is localized through
   the existing premium copy fallback (Traditional Chinese continues to use the
   existing zh fallback), and detail links preserve the selected SEO locale.
7. Targeted tests, full tests, typecheck, lint, build, diff check, and signed-out
   `/premium` HTTP protection pass. Authenticated Plus/real Supabase RLS and
   operator approval remain explicit external verification gaps.

## Stop boundary

This loop ends after the local implementation and verification evidence are
recorded. No production migration, authenticated operator action, real AI call,
deployment, commit, or push is included.
