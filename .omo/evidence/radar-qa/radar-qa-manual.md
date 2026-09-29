# Radar manual QA

Date: 2026-08-12 (Asia/Seoul)
Surface scope: local MemeCatch checkout `/Users/toris/projects/memecatch`.

## Verdict

Core Radar behavior: **PASS** (all requested executable scenarios passed).
Overall manual QA gate: **FAIL / blocked** because the requested local Supabase DB scenario could not run. The exact blocker is recorded below; static migration-contract tests are not counted as DB execution.

## `manualQa`

### `surfaceEvidence`

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| RADAR-001 | normalization, matching, YouTube exclusion, hysteresis | Node TypeScript module/data surface | `node --experimental-strip-types --input-type=module -e '...imports from ./lib/trend/radar.ts; assert normalization, SHA-256 dedupe, UTC timestamps, entity matching, YouTube exclusion, and transitionRadarState...'` | PASS | ART-02 |
| RADAR-002 | connector partial failure and durable health | Vitest connector execution surface | `pnpm vitest run lib/trend/radar-connectors.server.test.ts --reporter=verbose` | PASS | ART-04 |
| RADAR-003 | fake connector -> pulse E2E; persist every signal; YouTube only excluded from scoring; safety queue | Vitest server orchestration surface | `pnpm vitest run lib/trend/radar-pulse.server.test.ts --reporter=verbose` | PASS | ART-05 |
| RADAR-004 | outbox dispatcher success and retry path | Vitest server dispatcher surface | `pnpm vitest run lib/trend/outbox.server.test.ts --reporter=verbose` | PASS | ART-06 |
| RADAR-005 | Safety Review action validation, operator gate, RPC, audit, revalidation, replay | Vitest server action surface | `pnpm vitest run lib/actions/radar-safety.test.ts --reporter=verbose` | PASS | ART-07 |
| RADAR-006 | trend scoring failure stops fanout and cron exposes failure | Vitest cron/pulse surface | `pnpm vitest run app/api/cron/trend-pulse/route.test.ts --reporter=verbose` | PASS | ART-08 |
| RADAR-007 | production build and route presence | Next production build route manifest | `pnpm build` | PASS | ART-09 |
| RADAR-008 | deployed-like HTTP auth and admin route boundary | `next start` plus HTTP | `pnpm start -p 3100`; `curl -i http://127.0.0.1:3100/api/cron/trend-pulse`; `curl -i -H 'Authorization: Bearer wrong' http://127.0.0.1:3100/api/cron/trend-pulse`; `curl -i http://127.0.0.1:3100/admin/radar-safety` | PASS | ART-11 |
| RADAR-009 | minimal local Supabase DB scenario | local Supabase/Docker | `supabase status` and `docker ps -a --format '{{.Names}}\\t{{.Status}}' \| rg -i 'supabase\|memecatch'` | FAIL (blocked) | ART-10 |

### `adversarialCases`

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-001 | normalization/matching | Unicode, URL noise, whitespace, duplicate aliases | NFKC/lowercase text, URLs removed, hashtags deduplicated, stable dedupe hash, deterministic best entity match | PASS | ART-02 |
| ADV-002 | YouTube exclusion | high-scoring YouTube contamination | YouTube and `youtube_shorts` remain persisted/preserved but do not alter heat/confidence/platform aggregate | PASS | ART-02, ART-05 |
| ADV-003 | hysteresis | interrupted streaks and repeated threshold observations | State changes require consecutive observations; low/high streaks reset when interrupted; candidate/rising/trending/cooling/archive path completes deterministically | PASS | ART-02 |
| ADV-004 | connector isolation | one connector throws while peers succeed; malformed platform tag | Every connector is attempted; result is partial; failed connector is down with incremented durable health and peers still return signals | PASS | ART-04 |
| ADV-005 | outbox | channel dispatcher missing | Item is not falsely delivered; `finish_notification_outbox` is called with `p_succeeded:false`, and result reports failure/partial for retry | PASS | ART-06 |
| ADV-006 | Safety Review | invalid UUID/decision, non-operator, already-handled review | Reject before Supabase for invalid input; require operator; only audit/revalidate after RPC returns true; replay returns already-handled and does not audit | PASS | ART-07 |
| ADV-007 | trend pipeline | scoring RPC failure | Do not invoke either fanout; record failed `job_runs` row; cron returns HTTP 502 with failure error | PASS | ART-08 |
| ADV-008 | HTTP boundary | missing/wrong cron bearer and unauthenticated admin page | Cron returns 401 JSON; admin Radar page redirects to login; no unauthenticated privileged surface is exposed | PASS | ART-11 |
| ADV-009 | DB prerequisite | absent local Supabase container | Do not infer DB success from static tests; report exact blocker and missing prerequisite | FAIL (blocked) | ART-10 |

## `artifactRefs`

| id | kind | description | path |
|---|---|---|---|
| ART-01 | test-log | Targeted Radar suite: 6 files, 21 tests passed | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/01-targeted-vitest.log` |
| ART-02 | execution-json | Direct Node smoke assertions for normalization, matching, YouTube exclusion, and hysteresis; non-empty JSON output | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/02-pure-radar-smoke.json` |
| ART-03 | typecheck-log | TypeScript check (`pnpm exec tsc --noEmit --pretty false`) passed | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/03-typecheck.log` |
| ART-04 | test-log | Connector partial/all-failure/platform-tag adversarial scenarios | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/04-connectors-partial-failure.log` |
| ART-05 | test-log | Fake connector-to-pulse orchestration, persisted signals, aggregate exclusion, Safety Review enqueue | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/05-fake-connector-pulse-e2e.log` |
| ART-06 | test-log | Outbox configured delivery plus unconfigured-channel retry | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/06-outbox-dispatcher.log` |
| ART-07 | test-log | Safety Review action input/auth/RPC/audit/revalidation/replay cases | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/07-safety-review-action.log` |
| ART-08 | test-log | Trend failure-stop, cron auth, HTTP 502, and scheduled owner checks | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/08-trend-stop-cron.log` |
| ART-09 | build-log | Successful `next build --webpack`; route table includes `/admin/radar-safety`, `/api/cron/trend-pulse`, and `/api/memes/[id]/trend` | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/09-production-build.log` |
| ART-10 | environment-log | Local Supabase blocker: `No such container: supabase_db_memecatch`; no matching Supabase/MemeCatch Docker container | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/10-supabase-status.log` |
| ART-11 | HTTP transcript | `curl -i` production-start auth/admin boundary: 401 for cron requests, 307 login redirect for admin Radar | `/Users/toris/projects/memecatch/.omo/evidence/radar-qa/11-production-curl.log` |

Notes:

- The migration contract and rollup integrity Vitest files were not treated as DB execution evidence because local Supabase was unavailable.
- No product files were edited during this QA run; only this evidence matrix and execution artifacts were written under `.omo/evidence/radar-qa`.
