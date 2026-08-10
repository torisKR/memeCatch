# Loop 109 acceptance — one-cut learning handoff

## Target

Make the subscription's feedback loop visible in the primary one-cut dashboard:
after a subscriber has an existing or newly saved outcome rating, the same
screen must show the personalized Next Move that the rating currently selects.

## Acceptance criteria

- Keep the initial one-cut order action-first: reviewed recommendation, card
  preparation/result, then explicit use recording and outcome follow-up.
- In one-cut mode, render the existing `PlusNextMove` surface after the outcome
  follow-up only when there is a real learning signal: at least one loaded
  rating, or a rating saved during the current session.
- Recompute the Next Move from the local rating state so a successful rating
  save changes the visible recommendation without a page refresh.
- Preserve full inbox behavior, empty/unavailable states, owner-scoped API/RLS
  boundaries, and the existing privacy-safe recommendation DTO. Do not add a
  database table, RPC, migration, analytics field, or private outcome field.
- Add regression coverage for one-cut initial hiding, one-cut existing-rating
  visibility, post-rating recomputation, and full inbox rendering.

## Verification shape

- Run the focused Plus Next Move and Action Inbox tests.
- Run the full test suite, TypeScript, lint, build, and diff checks.
- Inspect rendered server markup and a jsdom rating-save flow. Production
  payment, authenticated RLS, translation publication, and deployment remain
  outside this loop's authority boundary.
