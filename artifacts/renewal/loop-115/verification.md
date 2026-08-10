# Loop 115 verification — LOC-021

## 결과

글로벌 검색의 `coverage-empty` 상태에서 한국어 원문 Explore와 첫 원문 상세의 기존 글로벌
번역 옵션을 함께 제공한다. 새 CTA는 번역이 준비됐다고 주장하지 않고, 기존 상세의 실제
`TranslationPriorityButton`과 signed-out/free/Plus/request-status gate로 사용자를 넘긴다.

## 변경 표면

- `lib/i18n-global-search.ts`
  - `translationOptions` copy를 `ko`·`en`·`ja`·`zh`·`zh-tw`에 추가했다.
- `app/[locale]/search/page.tsx`
  - query 결과의 첫 한국어 원문을 기존 `memePathFrom(short_id, slug)`로 만들고
    `#global-translation-title`을 붙인다.
  - 기존 Korean original Explore CTA 옆에 `See translation options` 계열 CTA를 추가하되,
    기존 `needsOriginalRecovery`와 같은 coverage-empty 조건에서만 렌더한다.
- `app/[locale]/search/page.render.test.tsx`
  - 네 locale copy·exact canonical anchor·active/unavailable/zero-result no-CTA를 고정했다.

새 DB/API/RPC/schema/persistence/translation content/OpenAI 호출/analytics event/payment
logic/production write/deploy는 추가하거나 실행하지 않았다. reviewed 번역 공급은 기존
LOC-007/LOC-010 gate인 **448/1,520** 상태로 남아 있다.

## 자동 검증

| 검사 | 결과 |
| --- | --- |
| focused Vitest: search page/render, translation lookup/routing, TranslationPriorityButton | **5 files / 63 tests passed** |
| full `pnpm test` | **171 files / 1,154 tests passed** |
| `pnpm exec tsc --noEmit` | 통과 |
| `pnpm lint` | 0 errors / 8 pre-existing warnings |
| `pnpm build` | exit 0; compile 10.2s, TypeScript 15.8s, static pages **81/81** |
| `git diff --check` | 통과 |

첫 full test 실행은 새 CTA의 `hover:bg-accent`가 기존 A11Y-002 source guard와 충돌해 1건
실패했다. `hover:brightness-110`으로 바꾸고 재실행한 full suite는 171 files / 1,154 tests를
통과했다. build의 기존 `metadataBase` warning 4건은 유지된다.

## 실제 표면 QA

Production build를 `next start --port 3100`으로 띄우고 local Chromium에서 확인했다.

1. `/en/search?q=좋다`
   - 한국어 결과 7건, localized eligible result 0건인 실제 coverage-empty 상태를 확인했다.
   - `Explore Korean originals`와 `See translation options` 두 CTA가 함께 표시됐다.
   - 새 CTA target은 `/memes/jkxv35tv-%EC%A2%8B%EB%8B%A4%F0%9F%91%8D-%EB%B0%88#global-translation-title`였다.
   - 클릭 후 실제 URL이 해당 anchor가 되었고, 상세의 `글로벌 번역` section과 네 locale 기존
     Translation Priority surface를 확인했다. signed-out 상태에서는 각 기존 pricing gate가 보였다.
2. `/en/search?q=밈`
   - 20건 중 localized `Chicken Jockey Meme` 결과가 포함된 active 상태를 확인했다.
   - 기존 Korean original 카드와 localized card가 유지되고 두 recovery CTA가 나타나지 않았다.
3. `/en/search?q=없는 밈 xyz`
   - zero-result Submit 상태를 확인했고 두 recovery CTA가 나타나지 않았다.
4. 브라우저 콘솔 오류는 변경과 무관한 기존 `/api/media/meme-thumbs/*` 이미지 CSP 차단이었다.
   - 새 handoff 경로의 navigation/anchor/DOM 오류는 관찰되지 않았다.

첫 coverage-empty click 전에는 기존 새 소식 dialog가 포인터를 가로막아, 기존 `확인했어요`
버튼을 닫은 뒤 fresh ref로 재시도했다. 기능 결함이 아니며 재시도는 성공했다.

## 운영 경계

이번 루프는 기존 한국어 상세·번역 요청 surface를 연결하는 local presentation-only handoff다.
실제 Plus 인증·RLS/RPC, 사람 번역 검수/publication, 결제, OpenAI live call, Supabase write,
production deploy/push/merge는 수행하지 않았다.

## 독립 검토

독립 code-reviewer **PASS — concrete findings 0**.

- coverage-empty의 두 recovery action 조건과 canonical `memePathFrom` anchor
- active/unavailable/zero-result no-CTA
- 네 locale copy와 번역 완료·자동 발행·Plus entitlement 비주장
- 기존 detail anchor, signed-out/free/save-required/Plus/request-status gate
- metadata/query/Korean fallback/analytics/submit 및 신규 DB/API/RPC/persistence surface 부재
- 44px 최소 높이와 focus-visible 접근성 스타일

리뷰어 자체 검증은 focused 5 files / 63 tests, full 171 files / 1,154 tests, tsc, 대상/전체
lint, production build, static safety scan을 PASS했다. TypeScript LSP는 설치되지 않아 `tsc`
및 build로 대체했다. 별도 architect 2-lane merge-readiness 레인은 현재 leaf-reviewer 제한으로
실행할 수 없었지만, Loop 115 코드·수용조건에 대한 concrete finding은 없다.
