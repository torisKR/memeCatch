# Loop 103 verification — PLUS-030 One-Cut Value Proof

## 구현 결과

- pricing과 active/upgrade Plus header를 기존 one-cut 결과 흐름 중심으로 정렬했다.
- pricing와 active dashboard checkout form에 UI locale을 hidden field로 전달했다.
- checkout API는 지원 로케일만 `localizedStaticPath("/pricing", locale)`로 변환해 signed-out `next` 경로를 보존하고, UI-only locale·잘못된 값·빈 body는 `/pricing`으로 수렴한다.
- `plus_pricing_view`, `plus_checkout_started`, `plus_checkout_returned`, `plus_one_cut_ready`, `plus_one_cut_prepared`, `plus_receipt_saved`를 추가했다.
- one-cut 계측에는 locale·count·bounded channel/artifact·idempotency flag만 보내며 meme ID, 제목, URL, private note, performance note는 보내지 않는다.
- 신규 DB table/RPC/migration/OpenAI 호출/payment provider 상태 변경은 없다.

## 자동 검증

- focused: `pnpm exec vitest run app/api/billing/checkout/route.test.ts components/premium/pricing-content.test.tsx components/premium/premium-dashboard-content.test.tsx components/premium/plus-global-action-inbox.test.tsx lib/i18n-premium.test.ts` — **5 files / 111 tests passed**
- full: `pnpm test` — **168 files / 1,095 tests passed**
- typecheck: `pnpm exec tsc --noEmit` — passed
- lint: `pnpm lint` — **0 errors / 8 existing warnings**
- build: `pnpm build` — sandbox DNS 제한으로 1차 sitemap 조회 실패 후 네트워크 권한 재실행에서 Next.js 16.2.10 webpack TypeScript 포함 **81/81 static pages passed**
- whitespace: `git diff --check` — passed

## Manual QA Gate

새 production server를 `localhost:3102`에서 기동한 뒤 다음을 확인하고 종료했다.

- `GET /en/pricing` → **200**; result-first English title, `name="locale" value="en"`, `does not auto-renew` 확인
- `GET /zh-tw/pricing` → **200**; Traditional Chinese result-first title와 `name="locale" value="zh-tw"` 확인
- `GET /premium` → **307**; `/login?next=%2Fpremium` redirect 확인

## 운영 경계

production 결제, authenticated Plus populated flow, Supabase migration/RLS/RPC, 번역 publication, OpenAI 호출,
deploy, push, merge는 실행하지 않았다. 이번 루프의 완료는 local code/test/build/HTTP gate에 한정한다.
