# Loop 114 verification — LOC-020

## 결과

`coverage-empty` 글로벌 검색에서 한국어 검색 결과를 그대로 숨기거나 번역 결과처럼
가장하지 않고, 사용자가 한국어 원문 Explore로 복구할 수 있는 명시적 선택형 CTA를
제공한다. 검색 결과가 이미 localized 되었거나, 조회가 unavailable이거나, 결과 자체가
없을 때는 CTA를 표시하지 않는다.

## 변경 표면

- `app/[locale]/search/page.tsx`
  - 검색 결과에 대해서만 localized result 수를 계산한다.
  - `coverage-empty` + query 결과 존재 + localized result 0건일 때만
    `data-localized-search-original-action` CTA를 렌더한다.
  - CTA target은 locale-safe helper를 통해 정확히 `/explore`이며, 기존 `Korean original`
    label·원문 링크와 검색/metadata 흐름은 유지한다.
- `lib/meme-translations.ts`
  - exact reviewed/current/depth-qualified 결과를 `active`·`coverage-empty`·`unavailable`로
    구분한다. 기존 Map 반환 API는 호환 wrapper로 유지한다.
- `lib/localized-search-recovery.ts`
  - CTA 노출 조건을 순수 fail-closed predicate로 분리했다.
- `app/[locale]/search/page.test.ts` 및
  `app/[locale]/search/page.render.test.tsx`
  - 네 SEO locale의 coverage-empty CTA와 active/unavailable/zero-result no-CTA를 고정했다.
- `lib/meme-translations.test.ts`
  - mocked Supabase client로 eligible row의 `active`, ineligible/empty row의 `coverage-empty`,
    query error와 throw의 `unavailable` 분류를 직접 고정했다.

새 DB/API/RPC/schema/persistence/translation content/OpenAI 호출/analytics event/production
write/deploy는 추가하거나 실행하지 않았다. 실제 reviewed 번역 공급은 기존 LOC-007/LOC-010
운영 gate인 **448/1,520** 상태로 남아 있다.

## 자동 검증

| 검사 | 결과 |
| --- | --- |
| focused Vitest: `app/[locale]/search/page.test.ts`, `app/[locale]/search/page.render.test.tsx`, `lib/meme-translations.test.ts`, `lib/i18n-routing.test.ts` | **4 files / 48 tests passed** |
| full `pnpm test` | **171 files / 1,154 tests passed** |
| `pnpm exec tsc --noEmit` | 통과 |
| `pnpm lint` | 0 errors / 8 pre-existing warnings |
| `pnpm build` | exit 0, `✓ Generating static pages ... (81/81)` |
| `git diff --check` | 통과 |

첫 sandbox build는 sitemap의 공개 Supabase 조회에서 DNS `ENOTFOUND
onjipuldngbdptldkpoe.supabase.co`로 중단됐다. 동일 코드와 네트워크 권한으로 재실행한
build는 compile·TypeScript·static generation 81/81을 모두 통과했다. 기존 metadataBase
warning은 유지된다.

## 실제 표면 QA

Production build를 `next start --port 3100`으로 띄우고 local Chromium에서 확인했다.

1. `/en/search?q=좋다`
   - 한국어 검색 결과 7건, localized eligible result 0건인 실제 coverage-empty 상태를 확인했다.
   - `Explore Korean originals` 상태 CTA가 렌더되고 target이 정확히 `/explore`였다.
   - CTA를 클릭해 실제 URL `http://127.0.0.1:3100/explore`와 한국어 Explore 화면 도착을 확인했다.
2. `/en/search?q=밈`
   - localized `Chicken Jockey Meme` 결과가 포함된 실제 active 상태를 확인했다.
   - localized 검색 결과가 있는 상태에서는 recovery CTA가 렌더되지 않았다.
3. render regression에서 `ja`·`zh`·`zh-tw` copy와 `unavailable`·zero-result no-CTA를 확인했다.
   - unavailable은 실제 DB 장애를 유발하지 않고 deterministic mock 경계로 검증했다.

첫 CTA click은 기존 site news dialog가 pointer를 가로채어, 기존 `확인했어요` 버튼을 닫은
뒤 fresh locator로 재시도했다. 기능 오류가 아니며 재시도 후 `/explore` 이동은 성공했다.
브라우저 콘솔의 오류는 변경 표면과 무관한 기존 `/explore` 이미지 CSP 차단
(`catchmeme.com/api/media/meme-thumbs/*`)과 AdSense 경고 1건이었다.

## 운영 경계

이번 루프는 local presentation-only 변경으로 종료한다. 번역 생성·사람 검수·publication,
authenticated Plus/RLS, 결제, Supabase migration/RPC 적용, OpenAI live call, production
deploy/push/merge는 수행하지 않았다.

## 독립 검토

독립 code-reviewer follow-up **PASS — remaining findings 0**.

- 네 locale coverage-empty CTA
- 네 locale active/unavailable no-CTA
- 네 locale zero-result no-CTA
- Supabase lookup의 active·ineligible/empty coverage-empty·query-error·thrown-error 분류
- reviewed/current/depth gate와 기존 query/metadata/analytics 경계

초기 리뷰가 지적한 테스트 커버리지 부족은 위 regression matrix와 mocked-client 경계 테스트로
보강했다. 리뷰어 자체 targeted 3 files / 33 tests, full suite 171 files / 1,154 tests,
TypeScript·lint·static safety scan·diff check를 확인했다. 리뷰어는 follow-up에서 build와
browser smoke를 다시 실행하지 않았지만, 이 검증 artifact의 앞선 local build/Chromium 증적은
그대로 유효하며 코드 변경은 테스트 보강뿐이다.
