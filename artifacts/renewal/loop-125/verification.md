# Loop 125 verification — PLUS-045

검증일: 2026-08-09 (Asia/Seoul)

## 자동 검증

| 검사 | 명령 | 결과 |
| --- | --- | --- |
| routing/delivery/action/proxy focused | `pnpm exec vitest run lib/plus-daily-signal-routing.test.ts lib/plus-daily-signal.server.test.ts lib/plus-global-action-inbox.test.ts components/premium/plus-global-action-inbox.test.tsx lib/plus-daily-signal-delivery.server.test.ts proxy.test.ts --reporter=dot` | PASS — 6 files / 87 tests |
| full regression | `pnpm test -- --reporter=dot` | PASS — 175 files / 1,228 tests |
| TypeScript | `pnpm exec tsc --noEmit --pretty false` | PASS |
| full lint | `pnpm lint` | PASS — 0 errors / 8 existing warnings |
| scoped lint | `pnpm exec eslint` on changed implementation/test files | PASS — 0 errors; 1 existing `no-img-element` warning in `plus-global-action-inbox.tsx` |
| diff integrity | `git diff --check` | PASS |
| production build | `pnpm build` | PASS — Next.js webpack, static pages 81/81; metadataBase warning pre-existing |

## Manual QA Gate

새 production build를 `./node_modules/.bin/next start -p 3100`으로 실행하고 local HTTP 요청을
관찰했다. 샌드박스의 포트 바인딩/DNS 제한으로 첫 build·start 시도가 실패했지만, 외부 write 없는
권한 확장 실행에서 build와 서버를 재확인했다.

```text
GET /premium?focus=meme-1&locale=en&from=daily_signal&email=private@example.com
status=307
redirect=http://127.0.0.1:3100/login?next=%2Fpremium%3Ffocus%3Dmeme-1%26locale%3Den%26from%3Ddaily_signal

GET /premium?focus=meme-1&locale=en&from=other
status=307
redirect=http://127.0.0.1:3100/login?next=%2Fpremium

GET /premium?checkout=return&email=private@example.com
status=307
redirect=http://127.0.0.1:3100/login?next=%2Fpremium%3Fcheckout%3Dreturn
```

이 결과로 로그인 후 돌아갈 `next` 안에 `focus`, `locale`, `from`이 모두 보존됨을 확인했다.
`focus=%3Cscript%3E` 입력은 proxy 단계에서 임의 서버 fetch로 이어지지 않고, Premium의 safe
parser가 invalid focus를 기본 `/premium` 경계로 fallback하도록 확인했다.

## 글로벌 번역 게이트

`pnpm translation:check`는 exit 1이었다. 이번 루프 변경으로 translation artifact를 만들거나
수정하지 않았으며, 결과는 기존 상태와 동일하다.

- artifacts: 448 / 1,520 rows
- missing: 1,072 (`en=258`, `ja=238`, `zh=290`, `zh-tw=286`)
- forbidden translation-table mutation: 18 statements
- non-machine reviewed publication attempt: 1 (`ja-slice11.sql`)

따라서 이번 루프는 route contract를 구현했지만 글로벌 locale route의 실제 공급·publication을
완료했다고 주장하지 않는다.

## 독립 리뷰

fresh `gpt-5.6-sol` high `code-reviewer` re-review: **APPROVE**. 최초 2건의 MEDIUM finding(source
marker 미검증/미계측, protected query broad propagation)을 각각 exact `daily_signal` gate와
PII-free `entry_source`, Daily Signal/checkout query allowlist로 해소했다. 중복 focus/locale/source와
checkout 회귀 테스트도 추가했으며, 추가 blocker는 없다.

## 운영 경계

production Supabase, 결제 provider, webhook, translation publication, external post, deploy,
commit/push는 수행하지 않았다. worktree의 기존 사용자 변경은 보존했다.
