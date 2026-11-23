<!-- inventory.mjs가 만든 파일. 손으로 고치지 않는다. -->
# 브라우저에서 도는 서드파티 코드

클라이언트 컴포넌트에서 닿는 모든 파일이 import하는 패키지와 Next 모듈. "Rust 페이지에서" 열은 UI-PLAN.md가 채운다(판단이라 스크립트가 만들지 않는다).

| 패키지 | import하는 파일 수 | 파일 | 닿는 페이지 수 |
| --- | --- | --- | --- |
| `next/navigation` | 40 | app/(default)/search/search-input, admin/admin-nav, admin/catalog-registration-form, admin/contribution-review, admin/house-original-form 외 35 |  |
| `next/link` | 38 | app/(default)/error, app/(default)/forgot-password/forgot-password-form, app/(default)/login/login-form, app/(default)/my/my-content, app/(default)/onboarding/onboarding-form 외 33 |  |
| `motion` | 15 | app/(default)/login/login-form, app/(default)/my/my-content, app/(default)/onboarding/onboarding-form, answer-card, auth-menu 외 10 | 64 |
| `lucide-react` | 9 | copy-text-button, header-menu, home/community-meme-battle, home/home-safety-showcase, language-selector 외 4 | 64 |
| `three` | 2 | home/home-scene-renderer, home/home-studio-artwork | 2 |
| `next/image` | 2 | admin/mpe-review-console, originals-editorial/original-edition-content |  |
| `react-markdown` | 1 | markdown-body | 1 |
| `remark-gfm` | 1 | markdown-body | 1 |
| `remark-breaks` | 1 | markdown-body | 1 |
| `class-variance-authority` | 1 | ui/button | 0 |
| `embla-carousel-react` | 1 | ui/carousel | 0 |
| `zod` | 1 | lib/catalog-registration | 1 |
| `clsx` | 1 | lib/utils | 2 |
| `tailwind-merge` | 1 | lib/utils | 2 |

## 스크립트 태그와 서비스 워커

| 무엇 | 파일 |
| --- | --- |
| Google Analytics (`@next/third-parties/google`) | app/_root/root-document, lib/analytics |
| AdSense 로더 (`pagead2.googlesyndication.com`) | adsense-script |
| `next/script` | adsense-script |
| 서비스 워커 (Serwist) | app/sw |
| 외부 임베드 iframe (YouTube·TikTok·Instagram) | content-url-preview, json-ld, meme-embed, lib/oembed, lib/sources/url |
