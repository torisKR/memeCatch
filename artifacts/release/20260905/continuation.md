# Main integration and security release

## Scope

Preserve the shared dirty activation checkout. Integrate current branches in a clean main worktree, verify billing/content/security, refine the approved dark home design, and deploy only through the existing release gates. No credential values or raw user data belong in this record.

## Execution ledger

1. COMPLETED: fetched and fast-forwarded main to `5f34b8c0c0178a0ebdd52d073db0353b5a5b2735`; merged activation/security branch and TikTok legal-copy branch. Integration SHA: `022c5980951b118456f60e096eff794c35b59dc9`.
2. COMPLETED: integrated build, database readiness, content checks, and homepage/manual QA. Homepage keeps the dark/orange design, uses a two-line headline, removes a decorative live indicator, and brings real trending content ahead of explanatory sections. Search routes and query field names are unchanged.
3. BLOCKED: production enforcement/deployment until the existing human-reviewed content gate is satisfied; remote main has not been pushed.

## Verified on the integration SHA

- Vitest: 289 files, 1,965 tests passed.
- TypeScript: passed.
- ESLint: no errors; seven existing warnings.
- Codex Security static verify-fix: all 15 prior findings have source-level fixes and regression coverage. This is not a new scan or live exploit validation. Original scan target: `798ffed90b325bd84b1be0e97d039fa4bdf916b5`; scan ID: `e012759f-f846-4fa2-b8d7-a3128ef71f39`.
- The incoming Plus trend-metrics fix uses server-only privileged queries after entitlement checks. Its backdated migration needs explicit ledger reconciliation; it must not be missed by timestamp-only deployment.

## Candidate verification after homepage refinement

- Full Vitest rerun: 289 files / 1,965 tests passed. TypeScript, focused ESLint, production build and `git diff --check` passed. The initial sandboxed build could not resolve external DNS; the network-enabled retry passed without code workarounds. Existing build warnings concern metadataBase.
- ACT-001 preflight, Preview runner, evidence-generator and translation-batch checker tests passed. Loopback-server tests required the normal network-enabled execution surface.
- Manual browser QA: home at desktop and 390×844; search submitted through the native form and returned two results; horizontal content width matched the 390px viewport; no browser console errors were observed for that flow. Header language selection and the existing sticky advertisement are unchanged.
- Preview pgTAP: all 81 assertions executed and passed; synthetic fixtures were rolled back. Full rows are in `preview-pgtap.json`. The rate-limit fixture now accounts for existing stale Preview counters while still asserting exactly 100 deletions per cleanup, without changing app limits or grants.
- Preview raw trend access after hardening: anon=false, authenticated=false, service_role=true.
- Supabase Advisor still reports two existing security-definer aggregate views and 91 warnings; this is not an advisor-clean release. The views intentionally retain aggregate visibility after raw reaction/vote privacy restrictions in `20260713100000_security_hardening.sql`; switching them to invoker blindly would change public counts. Further exposure review remains separate. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0010_security_definer_view).

## Live database readiness

Read-only counts on 2026-09-05: production has 4,373 public documents and zero satisfying `is_trusted_one_cut_meme`; Preview has five public documents and zero trusted documents. Production foundation is applied but enforcement and later migrations are missing. Do not attest human review, auto-resolve trust, or enable checkout to bypass this gate.

Existing read-only content checker reports 1,786 public documents without source URLs, 298 with unknown rights basis, 34 with unavailable representative media, and 4,212 below the content-depth threshold. These are existing data-quality findings, not repaired or approved content. The updated machine report is `docs/renewal/DATA_QUALITY_REPORT.json`.

The Preview environment inventory has no Unifi Pay API credentials. A production Unifi secret must not be reused to simulate a test closure. Earlier disclosed provider credentials need secure rotation before claiming production auth readiness; no secret was rotated during this continuation.

## Remaining release boundaries

- Apply/verify missing Preview hardening before deploying the exact clean candidate SHA.
- Keep `UNIFI_PAY_CHECKOUT_ENABLED` disabled until actual Unifi test transaction, entitlement, trusted One-Cut receipt/read-back, and refund closure are evidenced.
- Production order remains foundation → at least five human-reviewed trust resolves → enforcement → smoke → checkout enablement.
- Preserve webhook/refund reconciliation and payment audit data during rollback.
- Do not rotate production payment credentials without explicit authorization.
- Backup-only top-100 SEO campaign work remains in its previously deferred cycle; do not merge mixed historical WIP wholesale.
