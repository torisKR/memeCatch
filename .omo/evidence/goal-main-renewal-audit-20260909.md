# Main integration and renewal goal: current-state audit

## Goal retained

Synchronize main, integrate genuinely missing branch work, verify payments and meme content, and renew the public web design using plan-ceo-review and design-taste-frontend. No completion claim.

## Progress classification

Previous turn was progress: removed three obsolete Preview-only Supabase environment variables and verified production variables and main production-branch assignment were preserved. Preview automatic deployments remain enabled; this is not a successful Preview build.

## Current Git evidence

- Fetched origin on 2026-09-09.
- Remote main: e1105d6. Actual clean main checkout: /Users/toris/orca/workspaces/memecatch/main-2.
- Ran git pull --ff-only origin main there: Already up to date.
- Main now contains the main-2 product/security integration (a179856), test alignment (75a5a5f), Fairy Plus changes, and unique migration version fix (e1105d6).
- Original /Users/toris/projects/memecatch dirty worktree preserved.
- One open PR: #32, head 6d9bb27, bounds Fairy checkout intents. Its SQL/tests require verification before integration. Historical failing Preview status is unrelated to compilation of those SQL changes.
- Several old temporary worktrees are missing/prunable; branch references remain. No pruning or deletion performed.
- Existing stash: pre-merge duplicate meme products/news/locale work. Preserved, not applied blindly.

## Candidate classification

| Candidate | Evidence | Next action |
| --- | --- | --- |
| codex/activation-linked-trust and most feature branches | No commits outside origin/main | Do not merge again |
| codex/admin-activity-dashboard | 7a54da6 distinct commit identity, main already contains f4e926e dashboard release | Compare semantic differences, avoid duplicate cherry-pick |
| claude/upbeat-mendeleev-ec2a57 | 500beb6 distinct identity; main content-depth.ts already contains separate 150-character index and 250-character substantial gates | Check remaining file-level differences before concluding fully covered |
| brand-catch-signal-wip | Old 30-file brand snapshot, renamed branding and historic route layout | Review reusable assets only after brand decision; no blanket merge |
| backup/original-pre-reset-20260716 | Explicit backup/WIP plus routing documentation | Preserve; inspect any unique functional work without replacing modern main |
| PR #32 | Two-file Fairy SQL/test change | Run isolated SQL regression checks and review migration compatibility |

## Review and design decisions

Existing July CEO plan targets an older advertisement-led engagement roadmap; it is context, not approval for replacing current payment or branding choices. Existing July design audit is not evidence of current rendered quality.

Suggested direction: retain MemeCatch identity, orange brand tokens, route slugs, legal copy, analytics contracts and working payment logic; renew the public site's typography, spacing, hierarchy, imagery, responsive behavior and coherent light/dark tokens. Review admin/data-heavy screens separately; design-taste-frontend explicitly excludes dashboard styling.

Alternative: replace brand identity as well as public presentation. This requires an explicit choice because it changes the logo/name/color contract, adds migration risk and is not implied by visual renewal.

CEO review is pending the user's approach choice. No application source was changed during the review. Payment correctness, current content trust/rights quality, full branch semantic coverage, rendered desktop/mobile/light/dark renewal and final production verification remain unproven.
# User approval and resumed review

User explicitly approved proceeding on 2026-09-09: retain MemeCatch name,
orange brand and existing URLs while renewing the public web and continuing
branch integration plus payment/content validation. Do not ask this direction again.
Fresh `git pull --ff-only origin main` in the clean main-2 checkout returned
`Already up to date` at `e1105d6`.

Architecture review open issue: PR32 deletes expired reconciliation keys.
The delayed-webhook SQL failure was reproduced and rolled back locally.
Proposed decision: reuse outstanding intents for the same owner/project/price,
preserve their original identity and creation timestamp, and create new intents
only after consumption or a changed server-side contract. Existing service-role
boundary, account serialization, payment idempotency and refunds must remain.
Alternative: retain separate attempts with a bounded issuance policy; greater
storage and lifecycle complexity, but distinguishes parallel external payments.
This payment lifecycle decision is not yet approved. No application edits or
main merge have been made as part of this resumed review.
