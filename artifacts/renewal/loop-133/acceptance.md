# Loop 133 Acceptance — PLUS-049

- selected: PLUS-049 One-Cut Result Evidence and Outcome History Reopen
- date: 2026-08-10
- scope: local code and reviewable artifacts only

## Baseline

The compact One-Cut receipt form hid the existing result URL field and submitted
resultUrl as null. Outcome History intentionally omitted result_url from its
owner-scoped select, parser, DTO, and UI, so a saved external result could not
be reopened from Plus Memory.

## Acceptance

1. mode=one_cut requires a non-empty valid http: or https: result URL before
   the completion RPC is called.
2. The existing bulk receipt path remains compatible: its result URL is still
   optional, and legacy requests without mode default to bulk behavior.
3. Outcome History selects the existing result_url column within the existing
   owner-scoped query, validates its protocol again, and omits invalid rows
   fail-closed.
4. The History UI opens only a validated saved result URL in a new tab with
   noopener; rows without a URL show an explicit missing-result state.
5. private_note remains outside the select and DTO. No URL is fetched, no
   external platform is posted to, and no migration or production write is
   executed.

## Data and release boundary

- data migration: none
- production DB/RLS: not exercised
- external publishing/payment/deploy: not exercised
- authenticated Plus receipt: human gate
