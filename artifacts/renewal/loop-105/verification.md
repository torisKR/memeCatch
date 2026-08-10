# Loop 105 verification — PLUS-031 One-Cut Recommendation First

## 구현 결과

- `PlusGlobalActionInbox`는 `one_cut`에서만 추천 카드 목록을 Creator Pack 준비 블록보다 앞에 배치한다. 기본 `inbox` 모드는 기존 Creator Pack 블록 → ActionCard 순서를 유지한다.
- one-cut 활용 receipt는 ActionCard 내부가 아니라 준비 CTA·준비 결과·preview·상태 메시지 뒤에 렌더된다.
- 기존 `createCreatorPack`, blob preview, explicit receipt, completion API, privacy-safe analytics 흐름은 수정하지 않았다.
- default inbox 순서, one-cut 추천 우선 순서, one-cut receipt DOM 위치, empty/unavailable CTA 부재를 회귀 테스트로 고정했다.

## 독립 코드 리뷰

- 1차 리뷰는 기본 inbox 순서와 one-cut receipt 위치 회귀를 발견해 **REQUEST CHANGES**했다.
- 해당 두 지적을 수정한 뒤 동일 리뷰어가 exact current files를 재검토해 **PASS — APPROVE**했다.
- 리뷰어 확인: mode-specific order, ActionCard 밖의 one-cut receipt, default/one-cut/empty/unavailable 회귀 테스트.

## 자동 검증

- focused: `pnpm exec vitest run components/premium/plus-global-action-inbox.test.tsx` — **1 file / 14 tests passed**
- full: `pnpm test` — **168 files / 1,097 tests passed**
- typecheck: `pnpm exec tsc --noEmit` — passed
- lint: `pnpm lint` — **0 errors / 8 existing warnings**; the existing `<img>` warning remains on the preview component
- build: `pnpm build` — Next.js 16.2.10 webpack **81/81 static pages**, metadataBase warning remains
- whitespace: `git diff --check` — passed

## Manual QA Gate

fresh local production server를 `localhost:3115`에서 기동하고 종료했다.

- `GET /en/pricing` → **200**
- `GET /zh-tw/pricing` → **200**
- `GET /en/explore` → **200**
- `GET /premium` → **307** to `/login?next=%2Fpremium`
- authenticated Plus와 production payment/DB write 없이, static markup regression에서 one-cut 추천 카드가 `Create Creator Pack`보다 먼저 렌더되고 receipt가 준비 블록 뒤에 렌더되는 것을 확인했다. 기본 inbox 순서도 별도 회귀 테스트로 보존을 확인했다.

## 운영 경계

production 결제, Supabase migration/RLS/RPC, 번역 publication, OpenAI 호출, deploy, push, merge는 수행하지 않는다.
