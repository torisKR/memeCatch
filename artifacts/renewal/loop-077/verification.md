# Loop 077 Verification — PLUS-013

검증 일시: 2026-08-09 (KST)
대상: `/Users/toris/projects/memecatch`, branch `main`

## 결과

| 검사 | 결과 |
| --- | --- |
| targeted Scout contract | PASS — 4 files / 31 tests |
| full test | PASS — 139 files / 923 tests |
| typecheck | PASS — `pnpm exec tsc --noEmit` |
| lint | PASS — 0 errors, 기존 warning 7개 |
| production build | PASS — `pnpm build`, Next.js 16.2.10 webpack, static pages 73/73 |
| diff check | PASS — `git diff --check` |
| signed-out Premium HTTP | PASS — `/premium` 및 `?locale=en` 모두 307 login redirect |

## Targeted command

```text
pnpm exec vitest run lib/plus-global-scout.test.ts lib/plus-global-scout.server.test.ts components/premium/plus-global-scout.test.tsx components/premium/premium-dashboard-content.test.tsx --reporter=dot
4 files passed, 31 tests passed
```

테스트에는 다음 경계가 포함된다.

- free user query 0회와 Premium branch 전용 결과
- `approved|limited`, `green|yellow`, `rising|active`와 필수 source 필드
- `ko` canonical 및 4개 exact reviewed/current locale
- missing/machine/stale/incomplete/no-slug 번역 무fallback
- input order 독립성, KST UTC 경계, 날짜 변경에 따른 deterministic 회전, 최대 5개
- source/translation 조회 실패의 `unavailable`과 적격 후보 없음의 `empty`
- 5 locale card copy/link, proof/safety/lifecycle/accessibility attributes, Premium dashboard wiring

## HTTP 관찰

로컬 production server(`next start -H 127.0.0.1 -p 3110`)에서 인증 쿠키 없이 확인했다.

- `GET /premium` → `307`, `Location: /login?next=%2Fpremium`
- `GET /premium?locale=en` → `307`, `Location: /login?locale=en&next=%2Fpremium`
- 두 응답 모두 `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, HSTS와 `content-language: ko`를 확인했다.
- free/signed-out 화면에 Scout data를 노출하지 않는 것은 loader no-query test와 server page의
  `entitlement.isPremium` 조건으로 검증했다. authenticated Plus 성공 화면과 실제 live 후보는 세션 부재로 미검증이다.

## Build 네트워크 메모

샌드박스 네트워크에서 첫 `pnpm build`는 `/sitemap.xml` prerender 중
`getaddrinfo ENOTFOUND onjipuldngbdptldkpoe.supabase.co`로 종료됐다. sitemap 조회 실패를
숨기지 않는 기존 계약의 결과이며 코드 컴파일 실패가 아니다. 동일 build를 승인된 network escalation으로
재실행해 `73/73` static pages와 route table 전체를 확인했다.

## 미수행 운영 게이트

- authenticated Plus 실제 `/premium` active branch 및 실제 `meme_translations` reviewed/current 후보
- Supabase RLS/production DB와 migration 적용
- production deploy/push/merge
- 실제 OpenAI 호출과 번역 생성/적용

