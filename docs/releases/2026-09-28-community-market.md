# MemeCatch community and creator market — 2026-09-28

> Historical snapshot of the initial isolated-worktree build. The implementation has since been integrated into `/Users/toris/projects/memecatch` while preserving preexisting work. The current integration, QA findings, local fixes, and deployment prerequisites are documented in `docs/releases/2026-09-28-original-integration-qa.md`. The old Vercel deployment below does not include these subsequent QA fixes and must not be promoted as the final verified revision.

## Release status at the initial isolated build

- Implementation checkout: `/Users/toris/.devspace/worktrees/memecatch-fb1078b1` (DevSpace `ws_2fa73f39d8`).
- Baseline: `3d10dc0095001fc5595fe8b563ef2f78b0462de2`, the verified currently deployed Git revision.
- Original `/Users/toris/projects/memecatch` checkout and its existing uncommitted changes were not edited, reset, stashed, or deployed. New implementation is uncommitted in the isolated worktree; no Git push was made.
- New Vercel production-environment deployment: `dpl_72JqePA2Xd38RGofBz8abeWMwwVs`.
- Deployment URL: https://memecatch-car8p28rn-ironjustlikethatgmailcoms-projects.vercel.app
- Vercel project: `prj_fWt03H8a0rZtoDuCxczV7NhM4OEd`; scope: `ironjustlikethatgmailcoms-projects`.
- Cloud build completed successfully at 2026-09-28 04:15 KST. Deployment was created with `--prod --skip-domain` to keep the existing public site unchanged during verification.
- **Not promoted to catchmeme.com.** The authenticated preview-check and promotion commands were blocked by the tool security gate. No workaround or additional promotion was attempted. The new URL requires Vercel authentication. Review/promote this exact deployment through the authorized Vercel project before describing the new UI as live.
- Previous production deployment remains the rollback/reference target: `dpl_3z4Utbdh97EsgoRccMBPSbH583Ku`, https://memecatch-5su8o7oni-ironjustlikethatgmailcoms-projects.vercel.app.

## Implemented experience

- Direct latest-meme (`/explore?sort=recent`), community, and products navigation on desktop and mobile.
- Compact home discovery strip with story, meme-report, and creator-product registration actions.
- Existing owned hero artwork served AVIF-first with WebP fallback and explicit intrinsic dimensions. Existing mascot reused in community empty states. No newly commissioned/generated illustration is claimed.
- Community writing/discovery actions remain available in empty, loading, and error states.
- Separate approved creator promotions within the existing affiliate storefront.
- Authenticated product registration: image, title, description, HTTPS destination, optional price, category, relationship disclosure, rights attestation.
- Owner management and editing (`/products/mine`, `/products/new?edit=<id>`); edits return to pending review.
- Operator-only moderation (`/admin/creator-products`) with admin navigation and approve/reject workflow.
- Private image upload with raster MIME/byte validation and 5 MB limit; same-origin authorized image byte responses with `nosniff` and `private, no-store` rather than signed-URL redirects.
- Additive RLS/column grants and authenticated RPCs; no direct client table writes or self-approval. Durable creator-specific upload quota and five submissions per user per day. Existing affiliate data and shared quota functions are unchanged.
- This is external-link product promotion, not an on-platform payment/order/settlement system. No fabricated seller listings or sales figures were seeded.

## Applied production database changes

Supabase project: `onjipuldngbdptldkpoe`.

Applied through the connected migration tool:
1. `creator_products_reviewed_market_20260928` — creator products table, private storage bucket, isolated quotas, authorization policies and RPCs. Reviewed local schema source: `supabase/migrations/20260927184114_creator_products.sql`.
2. `reviewed_latest_meme_content_20260928` — reviewed original text-only editorial batch, inserted idempotently with references and sequential moderation transitions.

The hosted migration tool assigns its own migration version/name. Do not blindly push all historical local migrations; reconcile hosted migration history before future CLI database pushes.

## Published content

Batch source: `data/editorial/2026-09-28-latest-memes.json`.
Batch ID: `editorial-2026-09-28-latest-memes`.
Published timestamp: 2026-09-28 04:08:06 KST.

| Title | Public path | Database ID |
| --- | --- | --- |
| 아이워시 챌린지 (에이아이돌) | `/memes/gjq95suv` | `96bd6b41-4e72-4fe7-a87a-eb97b5dfa7a1` |
| OO 포기하겠습니다… 생각해보니 진행하겠습니다 | `/memes/wg65waqu` | `ce72bd39-3762-457e-a118-a6edfcf9807f` |
| 장원영 OO (밤티의 반대말) | `/memes/vpcfycm4` | `deb0f94c-ca7c-4f2e-8c07-8c6ad804f68f` |
| OO삐 (삐에로 말장난) | `/memes/huuwcwma` | `a9b23f6b-1065-4837-94a5-1da19b1206b5` |
| 리멤버 노벰버 2026 (북극곰 밈) | `/memes/bv8mem48` | `e2f8dd5c-f109-4691-b6dd-71735e4a6c8e` |

Read-back verified all five records: `moderation_status=limited`, `media_type=text`, two linked references each (10 source associations), zero rehosted media entries, no manufactured trend score. Original occurrence, recent spread, source publication dates, and our review date are distinguished. The 2017 interview-message format is explicitly recorded as a 2026 revival. Some sources are two pages from one publisher, not independent double verification; caveats are recorded in the batch.

Public HTML checks confirmed all five correct page titles and all five titles in `/explore?sort=recent` on catchmeme.com. These content updates are already live even though the new application deployment is not promoted.

Repeatable validation:

```sh
node scripts/reviewed-meme-batch.mjs data/editorial/2026-09-28-latest-memes.json
node --test scripts/reviewed-meme-batch.test.mjs
```

`--sql` prints a reviewed SQL transaction only; it never connects to or writes to the database. The script validates source URLs/dates/required fields, rejects identity duplicates and unexpected fields, and only updates newly inserted IDs. No new recurring collection job or unreviewed auto-publishing schedule was enabled.

## Verification evidence

- Node 24.16.0, matching production runtime: full Vitest suite **319 files / 2,176 tests passed**.
- Editorial validator/SQL generator: **11 tests passed**.
- TypeScript `tsc --noEmit`: passed.
- Focused ESLint and `git diff --check`: passed.
- Independent review found and fixed signed-image CSP incompatibility, missing admin navigation, small-white-text contrast regressions, and the parent restored explicit moderation RPC grants after a quota refactor. Regression tests cover these changes.
- Vercel cloud production build: passed; 96 static pages generated and new dynamic routes included; deployment READY.
- Local preview build lacked preview Supabase variables. Locally pulled production sensitive values are redacted placeholders, so local Vercel production build failed on the placeholder site URL. No application validation was weakened and no secret was printed; the cloud build used its actual stored environment and succeeded.
- Supabase security advisor ran after DDL. New RPCs are not anonymously executable. Authenticated SECURITY DEFINER warnings are expected for the guarded RPC design; the server-only quota table intentionally has RLS with no direct client policies. Existing unrelated project advisories remain (including older mutable-search-path functions and disabled leaked-password protection); this feature release is not a claim that all legacy security findings were remediated.

## Remaining release checks

- Promote the READY deployment to the public domain using the authorized Vercel interface.
- Browser QA on mobile/desktop for the new application remains incomplete: protected deployment access was not available through the attempted tool path. No screenshot-based visual sign-off is claimed.
- A real signed-in seller upload/edit and operator approve/reject end-to-end scenario has not been executed. Application tests and SQL contract review are not a substitute for that scenario.
- Original-checkout integration was completed in the subsequent local QA task: 46 source files were integrated, the three overlaps were manually reconciled, and 209 unrelated preexisting user files were verified byte-identical (the initial inventory also included one newly created QA report). No commit or deployment was performed. See the current integration report for later QA fixes and remaining release prerequisites.
