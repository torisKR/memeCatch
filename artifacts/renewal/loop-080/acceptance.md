# Loop 080 acceptance — Plus Global Action Inbox

## Problem

Plus already has a global scout, rising alerts, translation fulfillment, and
saved-meme actions, but each panel exposes a different next step. The
subscriber must decide where to go next, and incomplete translation requests
can render locale links that are not publicly reopenable.

## Scope

- Add one server-derived, Plus-only action inbox with at most five
  deterministic actions.
- Reuse existing read models and builders: reviewed/current translation
  fulfillment, saved rising signals, and the global scout.
- Prioritize `translation_ready`, then `saved_signal`, then
  `new_reviewed`; deduplicate by meme ID.
- Use the web request locale for inbox content. Non-Korean actions require an
  exact reviewed/current/complete translation; no locale fallback is allowed.
- Do not add a table, RPC, cron, AI call, direct client DB query, or automatic
  write/publication.
- Remove links from non-ready translation fulfillment states; only a ready
  exact-locale request may open a localized detail page.

## Acceptance criteria

1. Free, signed-out, and expired Plus branches render no inbox DTO or private
   query; active Plus receives only the bounded server-derived DTO.
2. The inbox returns at most five unique meme IDs with deterministic priority
   and tie-breaking independent of input order.
3. A completed translation is actionable only when its exact locale is
   reviewed/current; `requested`, `in_review`, `stale`, and `dismissed` rows
   have no detail link.
4. Saved rising and global scout actions carry safe locale-aware links; an
   incomplete or stale non-Korean candidate is excluded.
5. A successful empty state is distinct from an unavailable upstream lane, and
   partial lane failures are visible without masquerading as zero content.
6. The dashboard places the inbox before the existing feed/action panels and
   keeps all existing feature surfaces and owner/security boundaries intact.
7. Korean, English, Japanese, Simplified Chinese, and Traditional Chinese
   fallback copy is covered through the existing premium copy contract.
8. Targeted tests, full tests, typecheck, lint, build, diff check, and
   signed-out `/premium` protection pass.

## Stop boundary

This loop ends after local implementation and observed signed-out production
HTTP. Authenticated Plus/live Supabase, production migration state, and
deployment remain external gates.
