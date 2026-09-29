# Fairy pending-intent release

Candidate SHA: e1c901836f519d4919ac304a85e9e5f94ecca938
Superseding candidate SHA: 736cfa42b4cf1e35bccc707165bf06207fda7d7d
Scope: PR32 plus approved delayed-reconciliation correction. Wider redesign is not part of this release.

## Review ledger

- Security | 736cfa42b4cf1e35bccc707165bf06207fda7d7d | PASS | /root/final_security: independently 38 SQL and race PASS, privileges preserved, safe loopback cleanup, no scoped security blocker.
- Aggregate review-work | 736cfa42b4cf1e35bccc707165bf06207fda7d7d | PASS | All five fresh lanes recorded above.
- Debugging runtime audit | 736cfa42b4cf1e35bccc707165bf06207fda7d7d | PASS (local) | Original delayed-key deletion and e1c9018 concurrency both toggled RED/GREEN; real PostgreSQL invocation and cleanup verified. Browser production gate pending.

- Code quality | 736cfa42b4cf1e35bccc707165bf06207fda7d7d | PASS | /root/final_code: no issues, red rejected SHA/green candidate concurrency proof, lock ordering no cycle, shellcheck/bash parser clean.
- Goal verification | 736cfa42b4cf1e35bccc707165bf06207fda7d7d | PASS | /root/final_goal: scoped requirements met, independently red/green concurrency verified, clean exact-SHA candidate ready for deployment.

- SQL/concurrency QA | 736cfa42b4cf1e35bccc707165bf06207fda7d7d | PASS | /root/final_qa: race harness + 3x8 checkout rounds, 38/38 pgTAP, final rollback; race DBs/Fairy tables/Fairy sessions all zero; worktree clean.

- Context mining | 736cfa42b4cf1e35bccc707165bf06207fda7d7d | PASS | /root/final_context exact-commit review. Report path labels used original checkout, but reviewed named commit blobs; parent verifies deployment worktree /tmp/memecatch-pr32-fix, not dirty f661506 checkout.

- Goal verification second pass | e1c901836f519d4919ac304a85e9e5f94ecca938 | FAIL | /root/goal_gate_verified independently ran committed SQL 38/38, then confirmed missing checkout/webhook serialization; concurs with code gate. Candidate remains rejected.

- Code quality | e1c901836f519d4919ac304a85e9e5f94ecca938 | FAIL | /root/code_gate reproduced concurrent webhook transaction consuming intent returned by checkout. Original candidate is NOT approved for deployment. No production mutation occurred.

## Additional concurrency fix in progress

Committed at 736cfa42b4cf1e35bccc707165bf06207fda7d7d. Parent directly ran
`./supabase/tests/fairy_checkout_race.sh`: PASS including 3x8 concurrent calls.
Executor independently proved original e1c9018 RED and working-tree fix GREEN;
local disposable DB cleanup verified. Script retained as executable regression.
Five fresh exact-SHA lanes dispatched; old SHA results are not reused as approval.

Working-tree migration now locks selected intent FOR UPDATE, then checks payment
existence in a fresh statement before reusing it. New regression script assigned
to /root/race_regression. All original candidate PASS lanes must be renewed at
the next commit; they are not coverage for uncommitted changes.

- Security | e1c901836f519d4919ac304a85e9e5f94ecca938 | PASS | /root/security_gate report: no reportable delta vulnerability, caller tests 29/29, role/HMAC/idempotency boundaries unchanged; SQL runtime evidence supplied by independent QA.

- Goal verification first pass | e1c901836f519d4919ac304a85e9e5f94ecca938 | FAIL (proof gaps, no code defect) | /root/goal_gate: tested stale local DB without transaction-loading migrations; also required remote SHA before pre-deploy gate. Fresh verifier dispatched with correct runnable SQL harness and independent 38+7 PASS evidence. Not counted as PASS.

- SQL QA | e1c901836f519d4919ac304a85e9e5f94ecca938 | PASS | /root/sql_qa final report: 38/38 pgTAP plus 7/7 owner/project/price and role probes; tables/users fully rolled back; no provider E2E claim.

- Context mining | e1c901836f519d4919ac304a85e9e5f94ecca938 | PASS | /root/context_gate final report. Expiry column is metadata only; no expiry enforcement is claimed. Agent GitHub access failed; parent independently verified PR32 OPEN and remote original SHA.

## Runtime journal

- Post-deploy HTTP: /, /pricing, /en/pricing, /explore and /sitemap.xml all 200; sitemap application/xml with urlset (742849 chars).
- Negative live API smoke: Fairy checkout GET 405; unsigned Fairy webhook POST 401 invalid_signature; anonymous entitlement 200 signedIn=false/isPremium=false. No checkout creation or real payment/refund performed.
- Exact deployment error-log query (10-minute window, limit 20) returned zero rows. This is bounded observation, not a permanent error-free claim.
- Aside post-deploy session TdPot8K0B1MwSxb7 active. Parent viewed initial full-page screenshot and spotted repetition; requested DOM-count/viewport-only verification before treating it as UI defect.

- Vercel production dpl_Aigf78HW5DJ48fEj7LPqci2PLTSs READY at exact SHA 736cfa42b4cf1e35bccc707165bf06207fda7d7d; aliases include catchmeme.com, www.catchmeme.com and memecatch.vercel.app.
- Aside baseline ephemeral session could not resume (Session not found); new post-deployment read-only QA session requested. No fallback to old baseline evidence.

- Production function prosrc MD5 matches reviewed body: 14f5f0e61546874cc8b0598c749b77c0.
- PR32 MERGED at 736cfa42b4cf1e35bccc707165bf06207fda7d7d.
- Production deployment dpl_Aigf78HW5DJ48fEj7LPqci2PLTSs building branch main / same SHA. Distinct Preview dpl_6y6VvfvY351X8UpniMd3MML5uatq failed; not used as acceptance evidence.
- Temporary .env.production.local removed after local build; deployment is remote Git build with actual production settings. Original reviewer scratch DB removed. Release worktree remains clean.

- Production migration apply_migration SUCCESS on onjipuldngbdptldkpoe. Generated ledger version 20260908171007 was normalized for this exact named entry to repository version 20260908010000; returned row confirmed. SQL statements retained, no billing rows removed.
- Production read-back: row lock=true, post-lock consumed recheck=true, no delete=true; anon/authenticated execute=false, service_role=true.
- Atomic non-force push updated PR source and main to 736cfa42b4cf1e35bccc707165bf06207fda7d7d. main-2 fast-forwarded to same SHA.

- Production build PASS with NEXT_PUBLIC_SITE_URL=https://catchmeme.com; 92/92 static pages including sitemap.xml generated. Other pulled sensitive placeholders mean this local artifact is not used as a prebuilt deployment; Vercel must build with actual production environment.
- Baseline production: dpl_DVUhKdgp2cudpF8t9XE2CSTc2KwS, READY, e1105d69c93dbb3f67040fd329757ae022dbac46.
- Production RPC privileges verified: anon=false, authenticated=false, service_role=true.
- Production security advisors report existing warnings outside changed function (search_path, public extension and public-callable functions). No claim of a clean whole-project security audit.

## Release steps

1. COMPLETE: exact-SHA five-lane review.
2. COMPLETE: reviewed production migration, function hash/privileges/ledger verified.
3. COMPLETE: main fast-forward and Vercel production READY at exact SHA.
4. COMPLETE: Aside desktop post-deployment smoke and read-only HTTP checks.
5. COMPLETE: temporary environment file removed; limitations recorded below.

## Final browser QA

Aside session TdPot8K0B1MwSxb7 completed exit 0 after production READY.
PASS: home, pricing, en/pricing, explore, visible-card detail content and sitemap.
Fairy support button displayed; Unifi checkout remains intentionally disabled.
Observed console/page errors, failed requests and HTTP 4xx/5xx: zero in browser scope.
Full-page home capture repeated due stitching; DOM h1/header/main each one and
viewport-only screenshot verified by parent. No actual DOM duplication found.

Evidence screenshots:
- /Users/toris/.aside/u/0/sessions/2026-09-09_TdPot8K0B1MwSxb7/tmp/catchmeme-home-viewport.png
- /Users/toris/.aside/u/0/sessions/2026-09-09_TdPot8K0B1MwSxb7/tmp/catchmeme-pricing-desktop.png

Limitations: Aside viewport resizing unsupported, so mobile QA not performed.
No real production payment/donation/refund or authenticated entitlement mutation
was performed. Local regression plus production function identity and browser
smoke do not claim a live financial E2E. Wider content audit and redesign remain
outside this completed bounded release.

- Full Vitest: 294 files, 2003 tests passed. Focused Fairy handlers: 19 passed. TypeScript noEmit passed. ESLint: zero errors, six existing no-img-element warnings. git diff --check clean.
- First build compiled/typechecked but failed because pulled NEXT_PUBLIC_SITE_URL was a Vercel SENSITIVE placeholder. Retrying with public URL override; no code workaround.
- Aside baseline: homepage renders, /en/pricing?source=alert_briefing_setup shows existing New purchases are temporarily unavailable. No payment/settings mutations.

- No production mutation yet. Production Fairy table exists; expires_at absent.
- Aside baseline session TqbchWcAMHsIdncw started after launching Aside app.
- Temporary production environment file: /tmp/memecatch-pr32-fix/.env.production.local. Remove after build/deploy verification. Never commit or print contents.
- Local transaction-only pgTAP testing; never run synthetic user/payment fixtures on production.
- Prior red-green proof: original PR32 fails delayed reconciliation with unknown_intent; corrected SQL passed 38 assertions and rolled back.
