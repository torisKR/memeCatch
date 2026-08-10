# Loop 147 Verification — PLUS-060 Global Daily → One-Cut Activation

## 자동 검증

- Focused: `pnpm test -- --run --reporter=dot proxy.test.ts lib/plus-daily-signal-routing.test.ts lib/global-daily-challenge.test.ts lib/global-daily-challenge.server.test.ts lib/plus-global-action-inbox.test.ts components/premium/global-daily-challenge.test.tsx 'app/(default)/premium/page.test.tsx'` — 7 files / 87 tests passed.
- Full: `pnpm test -- --run --reporter=dot` — 183 files / 1,321 tests passed.
- `pnpm exec tsc --noEmit --pretty false` — passed.
- `pnpm lint` — 0 errors, 8 existing warnings.
- `pnpm build` — production build passed; static generation completed 81/81 with the existing `metadataBase` warning.
- `git diff --check` — passed.

## 실제 서비스 표면

외부 쓰기 없이 기존 local Next dev 서버(포트 3105)를 건드리지 않고 HTTP smoke를 수행했다. `/premium`은
`/login?next=%2Fpremium`으로 307 redirect되었고, `focus=meme-1&locale=ja&from=global_daily`도 동일한
focus/source/locale을 보존한 login return으로 307 redirect되었다. `/en/explore`, `/en/daily`, `/ja/explore`,
`/zh/explore`, `/zh-tw/explore`는 모두 HTTP 200이었다. 별도로 `next start -p 3100`도 시도했으나 현재
Next 16/Serwist production 산출물에 루트 `prerender-manifest.json`이 없어 기동하지 못했다.

## 검수된 경로 회귀

- `GlobalDailyCandidate[]`를 `LoadedGlobalDailyChallenge`에 보존하고, One-Cut projection에서 source-depth를
  이미 통과한 title/summary와 safe/active 상태만 사용했다.
- `from=global_daily`의 focus가 현재 3문항과 candidate의 content-locale slug/title/safety와 일치할 때만
  Action Inbox preferred item 및 `entry_source=global_daily`가 활성화된다.
- review shelf CTA는 same-origin Premium path만 렌더하고, UI-only display locale을 handoff에 쓰지 않는다.
- invalid safety/lifecycle, duplicate source/focus/locale array, missing/stale candidate, unavailable completion과
  existing Daily Signal/Scout/Use Kit regression을 focused tests로 닫았다. Proxy auth-return는
  `global_daily`를 allowlist하고, 임의/중복 query는 fail-closed한다.

## 독립 최종 리뷰

- `gpt-5.6-sol` high `code-reviewer` (Hubble the 6th) — `PASS / APPROVE`, CRITICAL/HIGH/MEDIUM/LOW 모두 0.
- 리뷰어는 ready 회귀가 정상 completed fixture를 그대로 재사용하고 `state`만 `ready`로 바꾸며,
  `preferredMemeId`·`globalDailyCandidate`·`entrySource=global_daily`가 비활성임을 확인했다.
- 리뷰어 검증: expanded focused 8 files / 128 tests, full 183 files / 1,321 tests, production build 81/81,
  TypeScript 통과, lint 0 errors/8 existing warnings, `git diff --check` 통과.

## 검증하지 않은 경계

인증된 Plus 데이터 공급, Supabase RPC/JWT/RLS runtime, 결제/webhook, completion·receipt production write,
번역 생성·검수·발행, 외부 게시와 production deploy는 실행하지 않았다.
