# MemeCatch security and integration release · 2026-09-05

## Result

Latest clean local main candidate: `e3084972dcc6b1101aca6012377137a7c655abf4` in `/private/tmp/memecatch-main-release-20260905`.
Latest Ready Preview: https://memecatch-56c6pfmhh-ironjustlikethatgmailcoms-projects.vercel.app
Original dirty checkout is preserved at `f6615062b82e0d676e9c028e1121f0169256c835`. Remote main has not been pushed because it can trigger production deployment before the existing production gates are met.

## Verification

- Codex Security existing scan: 15 findings statically rechecked as fixed at integration SHA `022c5980951b118456f60e096eff794c35b59dc9`. No new scan or live exploit testing is claimed.
- Candidate: 1,965 Vitest tests, TypeScript, focused lint, production build, diff whitespace checks passed. Full lint has seven pre-existing warnings.
- ACT-001 CLI/runner/evidence and translation checker tests passed.
- Preview SQL: all 81 pgTAP assertions executed and passed with synthetic fixtures rolled back. Result rows: `/private/tmp/memecatch-main-release-20260905/artifacts/release/20260905/preview-pgtap.json`.
- Added Preview raw-trend restriction and reconciled its ledger to `20260810110000_protect_plus_trend_metrics`. Verified anon/authenticated SELECT denied and service_role SELECT available.
- Manual home QA: desktop plus 390×844; native search returned results, no horizontal overflow or observed browser console errors. Approved dark/orange styling is retained; search and public meme content now lead the page.

## Initial Preview deployment (before mobile-header follow-up)

Deployment requested: `dpl_ETnnBL9iPrkNeEQJzgL41hbqg57d`.
URL: https://memecatch-1jqf4zunc-ironjustlikethatgmailcoms-projects.vercel.app
Exact candidate SHA passed as release metadata/build environment. Checkout and Bedrock generation are disabled for this deployment.

Verified deployment state: `READY`, target `preview`.
Runtime response header: `x-memecatch-release-sha: 0447e66d3837103b16847152d45170caec27c75c`.

Authenticated CLI smoke results:

| Request | Result |
| --- | --- |
| Korean home | 200; renewed headline and native search present |
| Home without language preference | 302; existing locale negotiation |
| Rankings, privacy | 200 |
| Premium while signed out | 307 |
| Web Push GET, upload POST while signed out | 401 |
| Checkout POST | 503, `checkout_disabled` |

Preview's small fixture dataset produces no eligible trending section; local QA used public production read-only data to verify the populated home state. Direct Preview browser QA remains blocked by the Vercel login screen. Browser-based interaction was verified locally; deployed HTTP checks used authenticated `vercel curl`. No deployment-protection setting was weakened.

Tooling: the requested Preview pin `vercel@59.10.0` was retained. Updating the older global Vercel CLI with `pnpm add -g vercel@latest` is recommended separately; no global install was changed.

## Unresolved production gates

- Production: 4,373 public documents; zero satisfy the One-Cut trusted predicate. The required five human-reviewed trust resolutions are not present. No automatic trust attestation was performed.
- Quality checker: 1,786 public documents lack source URLs; 298 have unknown rights; 34 have unavailable representative media; 4,212 fail content-depth criteria. These existing content issues remain, with the refreshed report in `docs/renewal/DATA_QUALITY_REPORT.json` in the candidate worktree.
- No Unifi Pay test API credentials in Preview environment inventory. Prerequisite CLI returns BLOCKED immediately when owner JWT and evidence inputs are absent; actual payment/refund closure is unverified.
- Advisor is not clean: two pre-existing security-definer aggregate-view alerts, 91 warnings, 19 informational notices. Aggregate views deliberately retain public counts after underlying user-row privacy restrictions. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).
- Earlier exposed provider credentials require secure rotation before production auth readiness can be claimed. No production credential was rotated here.

Production migration/deployment and checkout enablement have not been performed. Existing webhook/refund configuration and payment audit records remain intact.

The safe local/Preview branch of work is complete. Further production progress requires the existing trust/payment gates, or explicit approval to separate security-only production deployment from One-Cut activation. It is not safe to claim full commercialization readiness.

## Continuation: mobile header and trust-review preparation

The prior turn was progress: main integration, security verification and Preview deployment changed authoritative state. This continuation preserved the production hold and completed two remaining safe tasks.

- New local main SHA: `e3084972dcc6b1101aca6012377137a7c655abf4`.
- Fixed the mobile header's overlapping wordmark/language control. The brand and language selector share the first mobile row; search, alerts, account and menu remain available on the second. No auth or subscription behavior changed.
- Browser QA: 320px/390px mobile and 1024px desktop with the search field expanded. At 320px, the opened menu bounds were x=64..304, inside the viewport. Menu navigation to Global Feed worked. Global Feed's data loading was not claimed successful locally because the read-only local environment lacks its server service-role key.
- Full Vitest rerun: 1,965 passed. TypeScript, focused header lint, production build, and whitespace checks passed. No new dependencies.
- Prepared `.omo/evidence/trust-review-20260905/candidates.json` and README: ten actual production records, all labelled pending. Zero verified same-source meaning/origin claims; nine usage-example-only source roles. No publication, rights approval, trust resolution or paid AI call occurred.
- Located the official existing exporter at `lib/plus-trusted-evidence-exporter.server.ts` and its shared Action Inbox ordering. The pending review inventory is not an owner-specific export and does not claim top-five UI parity.
- Production counts rechecked: 4,373 public documents and zero trusted documents. The same human-review/payment gate remains unmet.

New Preview verified READY: `dpl_HC15SHr7tTaYDTgUPF36PgBFUt8R`, https://memecatch-56c6pfmhh-ironjustlikethatgmailcoms-projects.vercel.app.

Runtime verification: Korean home and Global Feed both returned HTTP 200 and exact release SHA `e3084972dcc6b1101aca6012377137a7c655abf4`. The new mobile-header layout was present in both responses; Global Feed did not render the unavailable error seen in the service-key-less local environment. Checkout still returned `checkout_disabled`. Preview browser interaction remains behind Vercel login; the interactive 320px/390px/1024px checks were local and the deployed checks were authenticated HTTP checks.

This continuation made concrete progress but did not resolve production prerequisites. Human trust review, credentialed Unifi closure, and the decision about a separate security-only production rollout still require user/external input. The full goal remains incomplete; no production change or remote main push was performed.

## Blocked audit: third consecutive gate check

2026-09-05 revalidation: local main remains clean at `e3084972dcc6b1101aca6012377137a7c655abf4`; fetched origin/main remains `5f34b8c0c0178a0ebdd52d073db0353b5a5b2735` with no newer remote main commits. Local main is 26 commits ahead and zero behind.

Production trusted-document count is still zero. The Preview environment inventory still contains no `UNIFI_PAY_*` or `ACT001_*` variables. No approval for a separate security-only production rollout has arrived.

The same gate was present in the integration/Preview turn, the mobile-header/review-inventory turn, and this revalidation turn. The first two turns made concrete progress; the available local and Preview work is now verified and there is no in-flight deployment to wait on. Further authorized production progress needs human review and test credentials, or a user decision changing the rollout boundary. Mark the full goal BLOCKED, not complete. All production settings, payment audits and the user's dirty checkout remain preserved.
