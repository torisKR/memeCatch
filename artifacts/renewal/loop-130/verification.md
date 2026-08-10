# Loop 130 Verification — ACT-001-RC

## 자동 검증

- `node --check scripts/plus-activation-preflight.mjs` — PASS
- `node --check scripts/plus-activation-preflight.test.mjs` — PASS
- `pnpm plus:activation:preflight:test` — PASS; 실제 임시 artifact SHA-256, URL/symlink/future timestamp, JWT/catalog, 401/403, manual 302, timeout, mixed/missing SHA, async CLI exit/redaction 포함
- `pnpm test` — 176 files / 1,250 tests PASS
- `pnpm exec tsc --noEmit` — PASS
- `pnpm lint` — 0 errors / 8 existing warnings
- `pnpm exec eslint --no-ignore scripts/plus-activation-preflight.mjs scripts/plus-activation-preflight.test.mjs next.config.ts` — PASS
- `pnpm build` — PASS; Next 16.2.10, TypeScript, static generation 81/81. 기존 `metadataBase` warning 유지
- `git diff --check` — PASS
- fresh `gpt-5.6-sol` high code review — PASS/APPROVE

## local production Manual QA

`next start -p 3100`에서 다음을 확인했다.

- `/en/pricing` — 200
- `/en/explore` — 200
- signed-out `/premium` — 307, `location: /login?next=%2Fpremium`
- `ACT001_PREFLIGHT_BASE_URL=http://127.0.0.1:3100 pnpm plus:activation:preflight` — exit 1, `ACT-001-RC BLOCKED`
- BLOCKED 이유 — Supabase schema/JWT 없음, authenticated core read 불가, evidence 없음, privacy outcome 문구 미충족, release SHA 없음
- 출력 — `readOnly=true`; `supportingDegraded=...`; secret/body/write method 없음

## live read-only 관찰

현재 live `https://catchmeme.com`은 `/en/pricing` 404, `/en/explore` 404, `/premium` 307 →
`/login?next=%2Fpremium`이다. 따라서 live는 ACT-001 preview activation 증거가 아니며, production에
write/deploy/payment를 수행하지 않았다.

## 미해결 human gate

격리 preview Supabase의 실제 schema/RLS/JWT, Unifi test payment, target migration ledger, clean RC
release SHA, Unifi/outcome/retention privacy/legal review, authenticated Plus receipt/outcome E2E,
translation publication과 production deploy는 다음 operator 승인·검증으로 남는다.
