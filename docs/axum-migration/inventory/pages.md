<!-- inventory.mjs가 만든 파일. 손으로 고치지 않는다. -->
> **기록 문서.** Next 앱을 옮기기 전의 조사다(L1에서 지움). 지금의 서버는 `server/README.md`.

# 페이지

`app/**/page.tsx` 66개. 렌더링 열은 `next build`가 만든 결과(`.next/prerender-manifest.json`)이고, 선언 열은 소스의 `dynamic`·`revalidate`다. 클라이언트 컴포넌트는 페이지가 직접 얹는 것만 센다(레이아웃이 얹는 14개는 client-components.md의 "레이아웃" 표시).

| 경로 | 레이아웃 | 렌더링 | 선언 | 메타데이터 | JSON-LD | hreflang | 서버 모듈 | 테이블·RPC | 클라이언트 컴포넌트 | 서버 액션 | 색인 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | (default), (default) (template) | ISR 3600s + loading | revalidate=3600 | metadata | DefinedTermSet, WebSite | 있음 | lib/community-battle.server, lib/index-gate.server, lib/meme-embedding-auth.server 외 1 | 5·2 | 8: home/community-meme-battle, daily-meme-quiz, safety-diagnostic-quiz 외 5 | lib/actions/auth | 예 |
| `/[locale]` | [locale] | 정적 생성(경로별) + loading | generateStaticParams; revalidate=3600 | generateMetadata |  |  | lib/index-gate.server, lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 5·2 | 5: safety-diagnostic-quiz, home/home-safety-showcase, home/translated-edition-hint 외 2 | lib/actions/auth | 문서별 판정 |
| `/[locale]/explore` | [locale] | 요청 시 렌더 + loading | generateStaticParams | generateMetadata | Explore |  | lib/index-gate.server, lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 5·2 | 1: meme-card | lib/actions/auth | 문서별 판정 |
| `/[locale]/meme-cards` | [locale] | 요청 시 렌더 + loading | generateStaticParams | generateMetadata |  |  | lib/meme-collectible.server | 2·0 | 1: meme-collectible-gallery | lib/actions/auth | 문서별 판정 |
| `/[locale]/memes/[key]` | [locale] | 요청 시 렌더 + loading | dynamic=force-dynamic; generateStaticParams | generateMetadata | MemeBreadcrumb, MemeDefinedTerm, MemeWebPage | 있음 | lib/index-gate.server, lib/korean-media-snapshot.server, lib/meme-delivery.server 외 3 | 8·2 | 5: share-button, save-button, meme-card 외 2 | lib/actions/auth | 문서별 판정 |
| `/[locale]/retired-products` | [locale] | 요청 시 렌더 + loading | dynamic=force-dynamic; generateStaticParams | generateMetadata |  |  | lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 4·2 | 0 | lib/actions/auth | 문서별 판정 |
| `/[locale]/search` | [locale] | 요청 시 렌더 + loading | generateStaticParams | generateMetadata |  |  | lib/index-gate.server, lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 5·2 | 4: app/(default)/search/search-input, tracked-block, search-outcome-tracker 외 1 | lib/actions/auth | 문서별 판정 |
| `/about` | (default), (default) (template) | 요청 시 렌더 + loading | dynamic=force-dynamic | generateMetadata |  |  | lib/index-gate.server, lib/korean-rankings.server, lib/meme-embedding-auth.server 외 1 | 5·2 | 0 | lib/actions/auth | 예 |
| `/admin` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  |  | 11·1 | 0 | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/activity` | (admin) | 요청 시 렌더 | dynamic=force-dynamic | metadata |  |  |  | 0·2 | 0 | lib/actions/admin-catalog, lib/actions/admin | 아니오 (robots.txt) |
| `/admin/analytics` | (admin) | 요청 시 렌더 | dynamic=force-dynamic | metadata |  |  |  | 0·1 | 0 | lib/actions/admin-catalog, lib/actions/admin | 아니오 (robots.txt) |
| `/admin/growth` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  |  | 3·1 | 0 | app/(default)/admin/growth/actions, lib/actions/admin-catalog 외 2 | 아니오 (robots.txt) |
| `/admin/inquiries` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  |  | 2·1 | 1: admin/inquiry-actions | lib/actions/admin-catalog, lib/actions/admin-inquiries 외 2 | 아니오 (robots.txt) |
| `/admin/memes` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  |  | 1·1 | 0 | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/memes/[id]` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  |  | 7·1 | 6: studio/artifact-studio, admin/meme-translation-review, admin/meme-origin-country-form 외 3 | lib/actions/admin-catalog, lib/actions/admin-translations 외 2 | 아니오 (robots.txt) |
| `/admin/memes/catalog/new` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  |  | 0·1 | 1: admin/catalog-registration-form | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/memes/new` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  |  | 0·1 | 1: admin/house-original-form | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/mpe` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  |  | 2·1 | 1: admin/mpe-upload-form | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/mpe/[id]` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  | lib/mpe/storage.server | 8·1 | 1: admin/mpe-review-console | lib/actions/admin-catalog, lib/actions/admin-mpe 외 2 | 아니오 (robots.txt) |
| `/admin/publisher-readiness` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  | lib/publisher-readiness.server | 1·1 | 0 | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/radar-safety` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  |  | 1·1 | 1: app/(default)/admin/radar-safety/review-form | lib/actions/admin-catalog, lib/actions/admin 외 2 | 아니오 (robots.txt) |
| `/admin/reports` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  |  | 4·1 | 1: admin/report-actions | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/sources` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  | lib/sources/recovery.server | 2·5 | 3: admin/source-recovery-panel, admin/source-review-card, admin/source-ingestion-form | lib/actions/admin-catalog, lib/actions/admin-sources 외 2 | 아니오 (robots.txt) |
| `/admin/submissions` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  |  | 2·1 | 1: admin/contribution-review | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/submissions/[id]` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  |  | 1·1 | 1: admin/submission-review | lib/actions/admin-catalog, lib/actions/admin 외 1 | 아니오 (robots.txt) |
| `/admin/translations` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading |  | metadata |  |  | lib/indexnow.server, lib/openai-review.server | 3·1 | 2: admin/missing-translation-draft-preview, admin/translation-review | lib/actions/admin-catalog, lib/actions/admin-translations 외 2 | 아니오 (robots.txt) |
| `/admin/users` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  |  | 2·1 | 0 | lib/actions/admin-catalog, lib/actions/admin-users 외 2 | 아니오 (robots.txt) |
| `/admin/users/[id]` | (default), (default) (template), (default)/admin | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  |  | 2·1 | 1: admin/user-controls | lib/actions/admin-catalog, lib/actions/admin-users 외 2 | 아니오 (robots.txt) |
| `/collections` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 1: adsense-host-gate | lib/actions/auth | 예 |
| `/collections/[slug]` | (default), (default) (template) | 정적 생성(경로별) + loading | revalidate=86400, generateStaticParams | generateMetadata |  |  |  | 1·0 | 3: adsense-host-gate, motion-list, meme-card | lib/actions/auth | 예 |
| `/community` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  |  | 1·0 | 0 | lib/actions/auth | 예 |
| `/community/[id]` | (default), (default) (template) | 요청 시 렌더 + loading |  | generateMetadata | ForumPosting |  |  | 2·0 | 2: community-comment-form, community-like-button | app/(default)/community/actions, lib/actions/auth | 예 |
| `/community/new` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  |  | 0·0 | 1: community-post-form | app/(default)/community/actions, lib/actions/auth | 예 |
| `/contact` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 0 | lib/actions/auth | 예 |
| `/editorial` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 0 | lib/actions/auth | 예 |
| `/explore` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata | ExploreCollection |  | lib/explore-preview-deadline.server, lib/index-gate.server, lib/meme-embedding-auth.server 외 2 | 5·2 | 3: adsense-host-gate, explore-grid, explore-filters | lib/actions/auth | 예 |
| `/forgot-password` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 1: app/(default)/forgot-password/forgot-password-form | lib/actions/auth | 아니오 (noindex) |
| `/global` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  | lib/global-feed.server | 2·0 | 1: meme-thumbnail | lib/actions/auth | 예 |
| `/guides` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 1: adsense-host-gate | lib/actions/auth | 예 |
| `/guides/[slug]` | (default), (default) (template) | 정적 생성(경로별) + loading | generateStaticParams | generateMetadata |  |  |  | 0·0 | 1: adsense-host-gate | lib/actions/auth | 예 |
| `/locale-rankings/[locale]` | locale-rankings/[locale] | 요청 시 렌더 | dynamic=force-dynamic | generateMetadata |  |  | lib/korean-rankings.server | 1·0 | 1: adsense-host-gate | lib/actions/auth | 문서별 판정 |
| `/login` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  |  | 0·0 | 1: app/(default)/login/login-form | lib/actions/auth | 아니오 (robots.txt) |
| `/meme-cards` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  | lib/meme-collectible.server | 2·0 | 1: meme-collectible-gallery | lib/actions/auth | 예 |
| `/memes` | (default), (default) (template) | 요청 시 렌더 + loading | dynamic=force-dynamic | generateMetadata |  |  | lib/index-gate.server, lib/meme-directory.server | 1·0 | 0 | lib/actions/auth | 예 |
| `/memes/[key]` | (default), (default) (template) | 요청 시 렌더 + loading | dynamic=force-dynamic | generateMetadata | MemeBreadcrumb, MemeDefinedTerm, MemeWebPage | 있음 | lib/index-gate.server, lib/korean-media-snapshot.server, lib/meme-contributions.server 외 5 | 8·3 | 15: adsense-host-gate, copy-text-button, meme-contribute 외 12 | app/(default)/submit/actions, lib/actions/auth 외 1 | 문서별 판정 |
| `/missing-public-meme` | (missing) | 정적 |  | metadata |  |  |  | 0·0 | 0 | lib/actions/auth | 아니오 (noindex) |
| `/my` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  | lib/meme-collectible.server | 4·1 | 3: daily-meme-quiz, meme-collectible-collection, app/(default)/my/my-content | lib/actions/auth | 아니오 (robots.txt) |
| `/news` | (default), (default) (template) | ISR 86400s + loading | revalidate=86400 | metadata | NewsCollection |  | lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 4·2 | 2: adsense-host-gate, news-page-content | lib/actions/auth | 예 |
| `/offline` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 0 | lib/actions/auth | 아니오 (noindex) |
| `/onboarding` | (default), (default) (template) | 요청 시 렌더 + loading |  | generateMetadata |  |  |  | 0·1 | 1: app/(default)/onboarding/onboarding-form | lib/actions/auth | 예 |
| `/originals` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 0 | lib/actions/auth | 예 |
| `/originals/edition/[slug]` | (default), (default) (template) | 정적 생성(경로별) + loading | generateStaticParams | generateMetadata |  |  |  | 0·0 | 1: originals-editorial/original-edition-content | lib/actions/auth | 예 |
| `/privacy` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 0 | lib/actions/auth | 예 |
| `/quiz` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 1: quiz-app | lib/actions/auth | 예 |
| `/quiz/r/[token]` | (default), (default) (template) | 요청 시 렌더 + loading |  | generateMetadata |  |  |  | 0·0 | 1: quiz-app | lib/actions/auth | 문서별 판정 |
| `/rankings` | rankings | 요청 시 렌더 | dynamic=force-dynamic | generateMetadata | Rankings |  | lib/korean-rankings.server | 1·0 | 1: adsense-host-gate | lib/actions/auth | 문서별 판정 |
| `/reset-password` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  |  | 0·0 | 1: app/(default)/reset-password/reset-password-form | lib/actions/auth | 아니오 (noindex) |
| `/retired-products` | (default), (default) (template) | 요청 시 렌더 + loading | dynamic=force-dynamic | metadata |  |  | lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 4·2 | 0 | lib/actions/auth | 예 |
| `/search` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  | lib/meme-embedding-auth.server, lib/meme-vector-lookup.server, lib/search-preview.server | 5·2 | 5: meme-reference-search, app/(default)/search/search-input, search-outcome-tracker 외 2 | lib/actions/auth | 예 |
| `/slang` | (default), (default) (template) | ISR 3600s + loading | revalidate=3600 | generateMetadata |  |  | lib/index-gate.server, lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 4·2 | 2: adsense-host-gate, slang-dictionary | lib/actions/auth | 예 |
| `/studio` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 1: studio/meme-studio-app | lib/actions/auth | 예 |
| `/submit` | (default), (default) (template) | 요청 시 렌더 + loading |  | generateMetadata |  |  |  | 0·0 | 1: submit-form | app/(default)/submit/actions, lib/actions/auth | 아니오 (robots.txt) |
| `/support` | (default), (default) (template) | 요청 시 렌더 + loading |  | metadata |  |  |  | 1·0 | 1: support/inquiry-form | lib/actions/auth, lib/actions/support | 아니오 (noindex) |
| `/terms` | (default), (default) (template) | 정적 + loading |  | metadata |  |  |  | 0·0 | 0 | lib/actions/auth | 예 |
| `/timeline` | (default), (default) (template) | 요청 시 렌더 + loading | dynamic=force-dynamic | generateMetadata |  |  | lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 4·2 | 2: adsense-host-gate, timeline-view | lib/actions/auth | 예 |
| `/weekly` | (default), (default) (template) | ISR 3600s + loading | revalidate=3600 | metadata |  |  | lib/meme-embedding-auth.server, lib/meme-vector-lookup.server | 4·2 | 5: adsense-host-gate, tracked-block, reveal 외 2 | lib/actions/auth | 예 |
