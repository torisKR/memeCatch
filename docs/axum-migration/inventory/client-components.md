<!-- inventory.mjs가 만든 파일. 손으로 고치지 않는다. -->
> **기록 문서.** Next 앱을 옮기기 전의 조사다(L1에서 지움). 지금의 서버는 `server/README.md`.

# 클라이언트 컴포넌트

`"use client"` 파일 121개, 24,517줄. "이유" 열은 그 파일이 쓰는 훅·브라우저 API·이벤트 핸들러 수·서드파티 패키지다. "쓰는 페이지"가 "없음"인 파일 가운데 `error.tsx`·`loading.tsx`·`global-error.tsx`는 Next가 import 없이 쓰는 경계이고, 나머지는 어떤 페이지에서도 닿지 않는다.

| 파일 | 줄 | 훅 | 브라우저 API | 핸들러 | 패키지 | 쓰는 페이지 |
| --- | --- | --- | --- | --- | --- | --- |
| `app/(default)/admin/error.tsx` | 26 |  |  | 1 |  | 없음 |
| `app/(default)/admin/radar-safety/review-form.tsx` | 67 | useActionState | FormData |  |  | 1: `/admin/radar-safety` |
| `app/(default)/error.tsx` | 102 | useEffect |  | 1 | next/link | 없음 |
| `app/(default)/forgot-password/forgot-password-form.tsx` | 85 | useActionState | FormData |  | next/link | 1: `/forgot-password` |
| `app/(default)/login/login-form.tsx` | 520 | useState, useActionState | FormData, location | 4 | motion, next/link | 1: `/login` |
| `app/(default)/meme-cards/error.tsx` | 11 |  |  | 1 |  | 없음 |
| `app/(default)/memes/[key]/view-tracker.tsx` | 41 | useEffect, useRef | window, localStorage, fetch |  |  | 1: `/memes/[key]` |
| `app/(default)/my/error.tsx` | 20 |  |  | 1 |  | 없음 |
| `app/(default)/my/my-content.tsx` | 609 |  |  |  | motion, next/link | 1: `/my` |
| `app/(default)/onboarding/onboarding-form.tsx` | 299 | useState, useFormStatus |  | 4 | motion, next/link | 1: `/onboarding` |
| `app/(default)/reset-password/reset-password-form.tsx` | 87 | useActionState | FormData |  |  | 1: `/reset-password` |
| `app/(default)/search/search-input.tsx` | 337 | useState, useEffect, useRef, useRouter | window, document, localStorage | 12 | next/navigation | 2: `/[locale]/search`, `/search` |
| `app/(default)/submit/error.tsx` | 30 |  |  | 1 |  | 없음 |
| `app/(default)/submit/loading.tsx` | 28 |  |  |  |  | 없음 |
| `app/[locale]/error.tsx` | 4 |  |  |  |  | 없음 |
| `app/global-error.tsx` | 29 |  |  |  |  | 없음 |
| `components/admin/admin-nav.tsx` | 122 | usePathname |  |  | next/link, next/navigation | 레이아웃(전 페이지) |
| `components/admin/catalog-registration-form.tsx` | 294 | useState, useRef, useTransition, useRouter |  | 24 | next/link, next/navigation | 1: `/admin/memes/catalog/new` |
| `components/admin/contribution-review.tsx` | 200 | useState, useTransition, useRouter |  | 8 | next/navigation | 1: `/admin/submissions` |
| `components/admin/house-original-form.tsx` | 481 | useState, useTransition, useRouter | fetch | 17 | next/navigation | 1: `/admin/memes/new` |
| `components/admin/inquiry-actions.tsx` | 87 | useState, useTransition, useRouter |  | 4 | next/navigation | 1: `/admin/inquiries` |
| `components/admin/meme-edit-form.tsx` | 350 | useState, useTransition, useRouter |  | 16 | next/navigation | 1: `/admin/memes/[id]` |
| `components/admin/meme-origin-country-form.tsx` | 118 | useState, useTransition, useRouter |  | 3 | next/navigation | 1: `/admin/memes/[id]` |
| `components/admin/meme-status-controls.tsx` | 251 | useState, useTransition, useRouter |  | 7 | next/navigation | 1: `/admin/memes/[id]` |
| `components/admin/meme-translation-review.tsx` | 383 | useState, useTransition, useRouter |  | 8 | next/navigation | 1: `/admin/memes/[id]` |
| `components/admin/missing-translation-draft-preview.tsx` | 457 | useState, useRouter |  | 11 | next/navigation | 1: `/admin/translations` |
| `components/admin/mpe-review-console.tsx` | 418 | useState, useTransition, useRouter |  | 15 | next/image, next/navigation | 1: `/admin/mpe/[id]` |
| `components/admin/mpe-upload-form.tsx` | 147 | useState, useRouter | fetch, FormData | 6 | next/navigation | 1: `/admin/mpe` |
| `components/admin/report-actions.tsx` | 85 | useState, useTransition, useRouter |  | 4 | next/navigation | 1: `/admin/reports` |
| `components/admin/safety-select.tsx` | 43 |  |  | 1 |  | 4: `/admin/memes/[id]`, `/admin/memes/catalog/new`, `/admin/memes/new` 외 1 |
| `components/admin/source-ingestion-form.tsx` | 254 | useState, useRouter | fetch | 4 | next/navigation | 1: `/admin/sources` |
| `components/admin/source-recovery-panel.tsx` | 142 | useState | fetch | 2 |  | 1: `/admin/sources` |
| `components/admin/source-review-card.tsx` | 285 | useState, useTransition |  | 6 |  | 1: `/admin/sources` |
| `components/admin/submission-review.tsx` | 400 | useState, useRef, useTransition, useRouter |  | 18 | next/navigation | 1: `/admin/submissions/[id]` |
| `components/admin/translation-review.tsx` | 395 | useState, useTransition, useRouter |  | 9 | next/navigation, next/link | 1: `/admin/translations` |
| `components/admin/user-controls.tsx` | 148 | useState, useTransition |  | 5 |  | 1: `/admin/users/[id]` |
| `components/adsense-host-gate.tsx` | 15 | useSyncExternalStore | window, location |  |  | 13: `/`, `/collections`, `/collections/[slug]` 외 10 |
| `components/answer-card.tsx` | 112 |  |  |  | motion | 1: `/memes/[key]` |
| `components/attribution-tracker.tsx` | 131 | useEffect | window, document, navigator, localStorage, sessionStorage 외 1 |  |  | 레이아웃(전 페이지) |
| `components/auth-invite.tsx` | 113 | useState, useEffect, usePathname |  |  | next/link, next/navigation | 1: `/memes/[key]` |
| `components/auth-menu.tsx` | 220 | useState, useEffect, useRef, usePathname | window, document, localStorage | 3 | motion, next/link, next/navigation | 레이아웃(전 페이지) |
| `components/bottom-nav.tsx` | 197 | usePathname |  |  | next/link, next/navigation | 레이아웃(전 페이지) |
| `components/comment-form.tsx` | 142 | useState, useEffect, useTransition, usePathname | window, localStorage | 2 | next/link, next/navigation | 1: `/memes/[key]` |
| `components/comments.tsx` | 294 | useState, useEffect, useTransition |  | 9 |  | 1: `/memes/[key]` |
| `components/community-comment-form.tsx` | 130 | useState, useEffect, useTransition, useRouter, usePathname | window, localStorage | 2 | next/link, next/navigation | 1: `/community/[id]` |
| `components/community-like-button.tsx` | 131 | useState, useEffect, usePathname |  | 2 | next/navigation | 1: `/community/[id]` |
| `components/community-post-form.tsx` | 525 | useState, useEffect, useRef, useTransition, useRouter | window, localStorage, requestAnimationFrame | 17 | next/link, next/navigation | 1: `/community/new` |
| `components/content-url-preview.tsx` | 257 | useState | fetch | 1 |  | 1: `/submit` |
| `components/context-nav.tsx` | 103 | useSearchParams |  | 2 | next/link, next/navigation | 1: `/memes/[key]` |
| `components/copy-text-button.tsx` | 79 | useState | navigator | 1 | lucide-react | 3: `/`, `/[locale]`, `/memes/[key]` |
| `components/daily-meme-quiz.tsx` | 293 | useState, useEffect | window, localStorage, fetch | 2 | next/link | 2: `/`, `/my` |
| `components/daily-top10.tsx` | 48 |  |  |  |  | 없음 |
| `components/explore-filters.tsx` | 430 | useState, useEffect, useRouter, usePathname, useSearchParams |  | 14 | next/navigation | 1: `/explore` |
| `components/explore-grid.tsx` | 703 | useState, useEffect, useRef | window, IntersectionObserver, fetch, location | 6 | next/link | 1: `/explore` |
| `components/explore-nav-link.tsx` | 95 | usePathname |  |  | next/link, next/navigation | 없음 |
| `components/export-button.tsx` | 230 | useState, useEffect, useRef | document, fetch | 5 |  | 2: `/[locale]/memes/[key]`, `/memes/[key]` |
| `components/generation-votes.tsx` | 288 | useState, useEffect, useTransition, usePathname |  | 4 | next/link, next/navigation | 없음 |
| `components/global-header.tsx` | 131 |  |  |  | next/link | 레이아웃(전 페이지) |
| `components/h-scroll.tsx` | 134 | useState, useEffect, useRef | ResizeObserver | 3 | motion | 없음 |
| `components/header-discovery-links.tsx` | 40 | usePathname |  |  | next/link, next/navigation | 레이아웃(전 페이지) |
| `components/header-menu.tsx` | 149 | useState, useEffect, useRef, usePathname | document | 3 | lucide-react, next/link, next/navigation | 레이아웃(전 페이지) |
| `components/home/community-meme-battle.tsx` | 156 | useState |  | 1 | lucide-react, next/link | 1: `/` |
| `components/home/home-chapter-nav.tsx` | 58 | useState, useEffect, useRef | window, document, requestAnimationFrame, location |  |  | 없음 |
| `components/home/home-discovery.tsx` | 275 | useState |  | 5 | next/link | 2: `/`, `/[locale]` |
| `components/home/home-safety-showcase.tsx` | 148 | useState |  | 3 | lucide-react, next/link | 2: `/`, `/[locale]` |
| `components/home/home-scene.tsx` | 495 | useState, useEffect, useRef | window, document, navigator, IntersectionObserver, matchMedia | 8 |  | 2: `/`, `/[locale]` |
| `components/home/translated-edition-hint.tsx` | 87 | useSyncExternalStore | document, navigator |  |  | 2: `/`, `/[locale]` |
| `components/house-original-visual.tsx` | 149 | useState |  | 2 |  | 3: `/[locale]/memes/[key]`, `/admin/memes/[id]`, `/memes/[key]` |
| `components/language-selector.tsx` | 139 | useRouter, usePathname | window, location | 1 | lucide-react, next/navigation | 레이아웃(전 페이지) |
| `components/login-gate.tsx` | 300 | useState, useEffect, useRef | window, document, location | 5 | motion, next/link | 3: `/[locale]/memes/[key]`, `/community/[id]`, `/memes/[key]` |
| `components/meme-card.tsx` | 109 | useState |  |  | next/link | 15: `/`, `/[locale]`, `/[locale]/explore` 외 12 |
| `components/meme-chat-character.tsx` | 29 | useState |  | 1 | lucide-react | 레이아웃(전 페이지) |
| `components/meme-chatbot.tsx` | 392 | useState, useEffect, useRef, useSyncExternalStore, usePathname | document, fetch | 7 | motion, next/navigation | 레이아웃(전 페이지) |
| `components/meme-collectible-collection.tsx` | 130 | useState, useEffect, useRef, useRouter | window, document, fetch, FormData | 4 | next/link, next/navigation | 1: `/my` |
| `components/meme-collectible-gallery.tsx` | 209 | useState, useEffect, useRef | window, document, requestAnimationFrame, fetch, history | 8 | next/link | 2: `/[locale]/meme-cards`, `/meme-cards` |
| `components/meme-collectible-scratch.tsx` | 151 | useState, useEffect, useRef | window, document, ResizeObserver, matchMedia, requestAnimationFrame | 1 |  | 2: `/[locale]/meme-cards`, `/meme-cards` |
| `components/meme-contribute.tsx` | 278 | useState, useEffect, useRef, useTransition, usePathname | window, location | 8 | next/link, next/navigation | 1: `/memes/[key]` |
| `components/meme-embed.tsx` | 748 | useState, useEffect, useRef | window, IntersectionObserver, fetch | 1 |  | 3: `/[locale]/memes/[key]`, `/admin/memes/[id]`, `/memes/[key]` |
| `components/meme-guess-game.tsx` | 272 | useState |  | 7 | motion, next/link | 없음 |
| `components/meme-reference-search.tsx` | 149 | useState, useEffect, useRef | fetch | 1 |  | 2: `/search`, `/studio` |
| `components/meme-thumbnail.tsx` | 77 | useState |  | 1 |  | 2: `/`, `/global` |
| `components/motion-list.tsx` | 82 |  |  |  | motion | 3: `/collections/[slug]`, `/my`, `/weekly` |
| `components/my-recent.tsx` | 106 | useState, useEffect | window, localStorage | 1 |  | 1: `/my` |
| `components/nav-progress.tsx` | 203 | useState, useEffect, useRef, usePathname, useSearchParams | window, document, history, location |  | next/navigation | 레이아웃(전 페이지) |
| `components/news-page-content.tsx` | 163 | useSyncExternalStore |  |  | next/link | 1: `/news` |
| `components/originals-editorial/original-edition-content.tsx` | 209 | useState, useEffect | document, navigator | 2 | lucide-react, next/image, next/link | 1: `/originals/edition/[slug]` |
| `components/pwa-install.tsx` | 370 | useState, useEffect, useRef | window, document, navigator, localStorage, sessionStorage 외 1 | 4 |  | 레이아웃(전 페이지) |
| `components/quiz-app.tsx` | 759 | useState, useEffect | window, navigator, fetch | 20 | next/link | 2: `/quiz`, `/quiz/r/[token]` |
| `components/random-meme-button.tsx` | 158 | useState, useEffect, useRef, useRouter, usePathname | window, document, fetch | 3 | next/navigation | 없음 |
| `components/reaction-bar.tsx` | 216 | useState, useEffect, usePathname | window | 2 | motion, next/navigation | 1: `/memes/[key]` |
| `components/related-video-list.tsx` | 120 | useState |  | 2 |  | 1: `/memes/[key]` |
| `components/resume-strip.tsx` | 72 | useState, useEffect | window, localStorage |  |  | 없음 |
| `components/reveal.tsx` | 50 |  |  |  | motion | 2: `/timeline`, `/weekly` |
| `components/safety-diagnostic-quiz.tsx` | 372 | useState |  | 3 | lucide-react, next/link | 2: `/`, `/[locale]` |
| `components/save-button.tsx` | 284 | useState, useEffect, useRef, usePathname | window, localStorage | 2 | next/navigation | 2: `/[locale]/memes/[key]`, `/memes/[key]` |
| `components/scroll-chrome.tsx` | 21 | useEffect | window, document, matchMedia |  |  | 레이아웃(전 페이지) |
| `components/search-outcome-tracker.tsx` | 64 | useEffect, useRef | window |  |  | 2: `/[locale]/search`, `/search` |
| `components/search-shortcut.tsx` | 28 | useEffect | document |  |  | 레이아웃(전 페이지) |
| `components/search-suggest.tsx` | 160 |  |  | 6 |  | 2: `/[locale]/search`, `/search` |
| `components/share-button.tsx` | 90 | useState | window, navigator, location | 1 |  | 2: `/[locale]/memes/[key]`, `/memes/[key]` |
| `components/signal-pointer.tsx` | 61 | useEffect | window, document, matchMedia, requestAnimationFrame |  |  | 레이아웃(전 페이지) |
| `components/site-footer.tsx` | 126 |  |  |  | next/link | 레이아웃(전 페이지) |
| `components/slang-dictionary.tsx` | 205 | useEffect, useRef, useSearchParams |  |  | next/link, next/navigation | 1: `/slang` |
| `components/social-video-preview-dialog.tsx` | 206 | useState, useEffect, useRef | window | 3 |  | 15: `/`, `/[locale]`, `/[locale]/explore` 외 12 |
| `components/studio/artifact-studio.tsx` | 196 | useState, useEffect, useRef |  | 17 |  | 2: `/admin/memes/[id]`, `/studio` |
| `components/studio/meme-studio-app.tsx` | 314 | useState | window, document, navigator, fetch | 7 | motion | 1: `/studio` |
| `components/submit-form.tsx` | 602 | useState, useEffect, useRef, useActionState | window, localStorage, FormData | 8 | next/link | 1: `/submit` |
| `components/support/inquiry-form.tsx` | 115 | useState, useTransition |  | 4 |  | 1: `/support` |
| `components/timeline-view.tsx` | 232 | useState, useEffect, useRef | window, document, IntersectionObserver, matchMedia, requestAnimationFrame 외 2 | 2 |  | 1: `/timeline` |
| `components/tracked-block.tsx` | 34 |  |  | 1 |  | 6: `/[locale]/search`, `/memes/[key]`, `/my` 외 3 |
| `components/trending-carousel.tsx` | 225 | useState, useEffect, useRef | window, document, IntersectionObserver, requestAnimationFrame | 3 | motion | 없음 |
| `components/ui/carousel.tsx` | 226 | useState, useEffect, useContext |  | 3 | embla-carousel-react, lucide-react | 없음 |
| `components/ui/live-caret-input.tsx` | 703 | useState, useEffect, useRef | window, document, requestAnimationFrame |  | motion | 없음 |
| `components/ui/tilt-card.tsx` | 59 | useEffect, useRef | requestAnimationFrame | 2 |  | 없음 |
| `components/webmcp/admin-tools.tsx` | 30 | useEffect | window, document, location |  |  | 레이아웃(전 페이지) |
| `components/webmcp/public-tools.tsx` | 22 | useEffect, useRouter | document |  | next/navigation | 레이아웃(전 페이지) |
| `lib/analytics.ts` | 190 | useEffect | window, navigator, fetch, location |  |  | 레이아웃(전 페이지) + 11: `/`, `/[locale]/memes/[key]`, `/[locale]/search` 외 8 |
| `lib/db/client.ts` | 70 |  | window, fetch, location |  |  | 레이아웃(전 페이지) + 13: `/`, `/[locale]/meme-cards`, `/[locale]/memes/[key]` 외 10 |
| `lib/i18n-client.ts` | 214 | useEffect, useContext, useSyncExternalStore | window, document, localStorage, sessionStorage, history 외 1 |  |  | 레이아웃(전 페이지) + 9: `/[locale]/meme-cards`, `/[locale]/memes/[key]`, `/login` 외 6 |
| `lib/quiz-card.ts` | 358 |  | document, navigator |  |  | 2: `/quiz`, `/quiz/r/[token]` |
| `lib/upload.ts` | 106 |  | fetch, FormData |  |  | 4: `/admin/memes/[id]`, `/community/new`, `/studio` 외 1 |
