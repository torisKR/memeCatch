<!-- inventory.mjs가 만든 파일. 손으로 고치지 않는다. -->
# 페이지가 기대는 서버 전용 부품

Rust 쪽에 아직 대응물이 없는 것들. 숫자는 테스트 파일을 뺀 `app`·`components`·`lib`·`proxy.ts` 기준이다.

## 쿼리 플래너 (`lib/db/plan.ts`, `lib/db/execute.ts`)

`.from("테이블")` 254곳, `.rpc(` 86곳, 파일 109개. 플래너 자체: `lib/db/plan.ts` 428줄, `lib/db/execute.ts` 796줄. 호출이 많은 파일:

| 파일 | `.from("…")` | `.rpc(` |
| --- | --- | --- |
| `lib/actions/admin.ts` | 23 | 5 |
| `lib/actions/admin-translations.ts` | 24 | 1 |
| `lib/mpe/candidates.server.ts` | 20 | 3 |
| `lib/queries.ts` | 15 | 1 |
| `lib/actions/admin-sources.ts` | 9 | 1 |
| `lib/sources/refresh.server.ts` | 10 | 0 |
| `lib/trend/radar-repository.server.ts` | 6 | 2 |
| `app/(default)/admin/memes/[id]/page.tsx` | 7 | 0 |
| `app/(default)/admin/mpe/[id]/page.tsx` | 7 | 0 |
| `app/(default)/admin/page.tsx` | 7 | 0 |
| `lib/actions/admin-mpe.ts` | 1 | 6 |
| `lib/meme-collectible.server.ts` | 7 | 0 |
| `lib/mpe/evidence-draft.server.ts` | 4 | 3 |
| `lib/tiktok-auth.server.ts` | 7 | 0 |
| `lib/actions/admin-stats.ts` | 5 | 0 |
| `lib/actions/admin-users.ts` | 4 | 1 |
| `lib/actions/community.ts` | 1 | 4 |
| `app/(default)/admin/reports/page.tsx` | 4 | 0 |
| `app/(default)/my/page.tsx` | 3 | 1 |
| `lib/actions/admin-inquiries.ts` | 3 | 1 |

## `next/cache`와 ISR

| 함수 | 파일 수 | 호출 수 | 파일 |
| --- | --- | --- | --- |
| `unstable_cache` | 3 | 3 | lib/catalog-read-cache, lib/index-gate.server, lib/meme-directory.server |
| `revalidateTag` | 9 | 12 | app/api/cron/source-refresh/route, lib/actions/admin-mpe, lib/actions/admin-sources, lib/actions/admin-translations, lib/actions/admin 외 4 |
| `revalidatePath` | 13 | 62 | app/(default)/admin/growth/actions, app/(default)/community/actions, lib/actions/admin-catalog, lib/actions/admin-inquiries, lib/actions/admin-mpe 외 8 |
| `updateTag` | 0 | 0 |  |
| `cacheTag` | 0 | 0 |  |
| `cacheLife` | 0 | 0 |  |
| `unstable_noStore` | 0 | 0 |  |
| `connection` | 0 | 0 |  |

캐시 태그(`lib/db/cache-tags.ts`): `PUBLIC_CATALOG_CACHE_TAG` = `public-meme-catalog`, `PUBLIC_COUNT_CACHE_TAG` = `public-social-platform-counts`.

`export const revalidate`를 둔 파일 6개: `app/(default)/collections/[slug]/page.tsx`, `app/(default)/news/page.tsx`, `app/(default)/page.tsx`, `app/(default)/slang/page.tsx`, `app/(default)/weekly/page.tsx`, `app/[locale]/page.tsx`.

## 그 밖

| 부품 | 파일 |
| --- | --- |
| `next/og` (Satori 이미지) | `app/(default)/memes/[key]/export/route.ts`, `lib/meme-share-card.tsx`, `lib/og-default-card.tsx`, `lib/quiz-og.tsx` |
| `@huggingface/transformers` (임베딩) | `lib/meme-embedding-runtime.server.ts` |
| i18n | `lib/i18n-client.ts` 214줄, `lib/i18n-global-explore.ts` 91줄, `lib/i18n-global-search.ts` 160줄, `lib/i18n-login.ts` 168줄, `lib/i18n-market-passport.ts` 120줄, `lib/i18n-meme-cards.ts` 34줄, `lib/i18n-my.ts` 596줄, `lib/i18n-pages.ts` 72줄, `lib/i18n-routing.ts` 366줄, `lib/i18n-server.ts` 10줄, `lib/i18n-submit.ts` 510줄, `lib/i18n.ts` 388줄 |
| 라우트 핸들러 53개 | (default)/memes, [locale]/llms-full.txt, [locale]/llms.txt, [locale]/memes, api/admin, api/analytics, api/auth, api/creator-products, api/cron, api/csp-report, api/daily-quiz, api/db, api/explore, api/health, api/media, api/meme-cards, api/meme-studio, api/memes, api/mpe, api/oembed, api/quiz, api/random-meme, api/upload, auth/callback, auth/tiktok, feed.xml/route.ts, feed/updated.xml, llms-full.txt/route.ts, llms.txt/route.ts, og/[locale] 외 3 |
| 서버 액션 파일 15개 (`"use server"`로 시작하는 파일), 함수 58개 | `app/(default)/admin/growth/actions.ts`, `app/(default)/community/actions.ts`, `app/(default)/submit/actions.ts`, `lib/actions/admin-catalog.ts`, `lib/actions/admin-inquiries.ts`, `lib/actions/admin-mpe.ts`, `lib/actions/admin-sources.ts`, `lib/actions/admin-translations.ts`, `lib/actions/admin-users.ts`, `lib/actions/admin.ts`, `lib/actions/auth.ts`, `lib/actions/community.ts`, `lib/actions/radar-safety.ts`, `lib/actions/submit.ts`, `lib/actions/support.ts` |
