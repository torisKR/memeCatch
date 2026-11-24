> **History.** The Next app this inventory describes was deleted in L1; the server now is `server/README.md`.

# What the Next server does that no route file shows (C1 inventory)

Measured on the standalone Next build of `main` (Next 16.3.4, `next build
--webpack`), port 3741, with requests that send no `Accept-Encoding` unless
stated. "Axum before C1" is what `server/` did before this batch. `PLAN.md`
(section C1) has the rows and the list of what still differs.

## 1. `proxy.ts` (runs before the router)

Matcher (`proxy.ts:400-411`): every path except `/api*`, `/auth*`,
`/_next/static`, `/_next/image`, `/favicon.ico` and names ending in
`.svg .png .jpg .jpeg .gif .webp .ico .xml .txt .webmanifest`; plus, for the
`www.catchmeme.com` host only, everything except `/api/`, `/auth/callback`,
`/auth/tiktok/callback`. `.avif`, `.js` (`/sw.js`) and `.json` paths are
matched, so they get `Content-Language`.

Every answer proxy.ts makes itself carries the `next.config.ts` security
headers and no `Vary`.

| Behaviour | Paths | Answer | Axum before C1 |
| --- | --- | --- | --- |
| www to apex (`wwwApexRedirect`, :197) | `Host: www.catchmeme.com`, GET/HEAD, not `/api`, `/auth/callback`, `/auth/tiktok/callback` | 301 `Location: https://catchmeme.com<path><query>`, body = the URL | forwarded (`routes/public.rs` `www_to_upstream`); Caddy does the same redirect in front (`deploy/Caddyfile:10-25`) |
| landing locale (`resolveLandingRedirectLocale`, :160) | `/` with cookie `memecatch_locale` = `en`/`ja`/`zh`/`zh-tw` | 302 `/en` etc. (query kept), body = location, no `Content-Language` | forwarded (home not ported) |
| `Content-Language` (:236) | every other matched answer, 404s and its own redirects included, `/sw.js`, `.avif` files | `ko`, or the document locale of a `/{locale}/...` path, or `?locale=` on `.../export` | native pages and routes set it themselves |
| `x-locale` request header (:235) | every matched path | read by Next's render only | not needed |
| retired products (`retiredProductDecision`, :240) | `lib/retired-products.ts` | 308, gone document, bare 404 | native (`pages/retired.rs`) |
| unknown collection or guide slug (:277) | `/collections/{x}`, `/guides/{x}` | 404 missing document | native (`page-collection`, `page-guide`) |
| meme canonical or missing (:289) | `/memes/{key}`, `/{locale}/memes/{key}`, navigations | 308 canonical, or 404 missing document | Korean native (`page-meme`); localized forwarded |
| auth gate (:356) | `/my*`, `/submit*`, `/admin*`, `/{locale}/...` of those | signed out: 307 `/login?next=<path>` (query kept only for `/submit` and `/admin*`, through `withAllowlistedSearch`); `/admin*` without `is_operator`: 307 `/` | forwarded |

## 2. `next.config.ts`

| Item | Detail | Axum before C1 |
| --- | --- | --- |
| `headers()` `/(.*)` (:197) | HSTS, nosniff, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Origin-Agent-Cluster`, CSP, `Reporting-Endpoints`, `X-MemeCatch-Release-Sha` with `RELEASE_SHA`; fixed at build time. On every answer except the `redirects()` 308s: 404, 405, 500 and 304 included | native routes (`headers.rs`) |
| `headers()` extensions (:241) | `/:path*.(svg png jpg jpeg webp avif ico woff2)`: `public, max-age=2592000, stale-while-revalidate=86400`, also on a 404 for such a path, and on `/favicon.ico`, `/icon.svg`, `/apple-icon.png` | no |
| `headers()` `/brand/*`, `/icons/*` (:253) | `public, max-age=31536000, stale-while-revalidate=86400`, over the extension rule, also on a 404 such as `/icons` | no |
| `headers()` `/sitemap.xml` (:276) | `public, max-age=0, s-maxage=3600, stale-while-revalidate=86400` | no (sitemap not ported) |
| `redirects()` (:172, `lib/retired-product-redirects.ts`) | 308 `/en/products[/...]` to `/en`; `/pricing`, `/premium[/...]`, `/daily` to `/`; `/{en,ja,zh,zh-tw}/{pricing,daily}` to `/{locale}`; then `/:path+/` to `/:path+`. Never for `/_next/*`. Answer: `Location`, `Refresh: 0;url=<location>`, body = location, no other header | forwarded, except native retired paths |
| `skipTrailingSlashRedirect: true` (:171) | the built-in redirect is off; the rule above replaces it, one slash per hop (`/about//` to `/about/`) | forwarded |
| `rewrites()` afterFiles (:178) | `/ar/opengraph-image/:path*` to `/ar` (a 404, `Content-Language: ar`); `/{18 locales}/rankings` to `/locale-rankings/{locale}` (a page) | forwarded |
| `images` (default) | `/_next/image?url=<local path>&w=<width>&q=75`: resized and re-encoded (WebP when `Accept` allows), `Vary: Accept`, `public, max-age=31536000, must-revalidate`, `Content-Disposition: attachment; filename=...`, a hash ETag; a width not in the list is 400 text. Used by `components/{meme-card-poster,meme-thumbnail-view,markdown-body,admin/mpe-review-console,originals-editorial/original-edition-content}.tsx` and by Axum's originals page (`server/src/pages/documents/originals.rs:84`) | forwarded |
| `trailingSlash`, `i18n` | not set (locales are routed by proxy.ts and `app/[locale]`) | - |
| `poweredByHeader: false` | no `X-Powered-By` | - |
| `experimental.globalNotFound` | `app/global-not-found.tsx` answers what no route matches | - |
| `output`, `serverExternalPackages`, `outputFileTracing*` | build only | - |

### Serwist (`@serwist/next`, `next.config.ts:19`, `app/sw.ts`)

- URL `/sw.js` (built into `public/`), scope `/`, served as a public file:
  `Cache-Control: public, max-age=0`, `Content-Language: ko`.
- Registered by Next's main client chunk on every Next page
  (`register: true` default) and reloads the page on `online`
  (`reloadOnOnline: true` default).
- Worker: `skipWaiting`, `clientsClaim`, `navigationPreload: true`.
  Precache `serwist-precache-v2-<scope>`: 233 `/_next/static/**` files and
  `/offline` (random revision per build). NetworkOnly: navigations, `/api/*`,
  `/auth*`, RSC requests, remote thumbnails; a failed document navigation
  gets the precached `/offline`. Everything else follows `defaultCache`
  (`@serwist/next/worker`): CacheFirst `next-static-js-assets`
  (`/_next/static/*.js`); StaleWhileRevalidate `next-image`,
  `static-image-assets`, `static-js-assets`, `static-style-assets`,
  `static-font-assets`; NetworkFirst `next-data`, `static-data-assets`,
  `apis`, `pages-rsc-prefetch`, `pages-rsc`, `pages`, `others`,
  `cross-origin`; the Google font caches.
- PWA features in use: the install prompt (`components/pwa-install.tsx`,
  `server/ui/pwa.js`, `app/manifest.ts`), the offline page for a failed
  navigation, the reload when the connection returns. No push, no
  notifications, no background sync, no share target.
- Axum before C1: native pages register no worker. A visitor who has Next's
  keeps it, and it keeps answering from its caches.

## 3. Files served without a route

| Path | Next's answer | Axum before C1 |
| --- | --- | --- |
| `public/**` (40 committed files: `ads.txt`, two verification `.txt`, `icons/`, `brand/`, `images/`, `ai-memes/`; plus the built `sw.js`) | 200 with `Accept-Ranges: bytes`, `Cache-Control` (`public, max-age=0` unless a `headers()` rule sets one), `Last-Modified` (mtime), `ETag: W/"<size hex>-<mtime ms hex>"`, `Content-Type` (`; charset=UTF-8` on text and JS), `Content-Length`, `Vary: Accept-Encoding`. gzip when asked, compressible and over 1 KB. `Range` gives 206; `If-None-Match` or `If-Modified-Since` give 304 with the validators and `Cache-Control` only; `HEAD` keeps the length; any other method is 500 `Internal Server Error` with two `Allow` lines. Case-sensitive; `..` resolved first; a trailing slash 308s | forwarded |
| `app/favicon.ico`, `app/icon.svg`, `app/apple-icon.png` | prerendered route handlers: 200, the extension `Cache-Control`, router `Vary`, chunked, no validators; another method is 405 `Method Not Allowed` with `Allow: GET`, `Allow: HEAD`. Pages link them as `/favicon.ico?<hash>` | forwarded |
| `app/manifest.ts` (`/manifest.webmanifest`) | prerendered: `application/manifest+json`, `public, max-age=0, must-revalidate` | forwarded |
| `app/robots.txt` | prerendered route | native |
| `app/sitemap.ts` (`/sitemap.xml`) | `force-dynamic`, reads the catalogue (514 lines): a route port, not a file | forwarded |
| `opengraph-image` | `/opengraph-image` native (R7); the per-meme images are R10 | partly |
| `/_next/static/**` | `public, max-age=31536000, immutable`, weak ETag; an unknown file is 404 `text/plain` with `private, no-cache, no-store, max-age=0, must-revalidate` | forwarded. Axum pages reference none; Next's pages, Next's worker precache and crawler render caches do |
| `/_next/image` | see `images` | forwarded; referenced by Axum's originals page |

## 4. Not found, errors, loading

| Case | Next's answer |
| --- | --- |
| one unknown segment (`/nope`, `/ko`; it matches `[locale]`, whose layout calls `notFound()`) | 404, the `[locale]/not-found.tsx` render: `<html id="__next_error__">`, an empty body until scripts run, title `이 밈은 아직 없어요`, `noindex, follow`; `s-maxage=3600, stale-while-revalidate=31532400` (or a `headers()` rule), `Content-Language`, ETag |
| more segments, `/api/<unknown>` (any method), `/_next/<unknown>`, `/{locale}/<unknown>`, `/rankings/x` | 404, `global-not-found.tsx`: full HTML, `private, no-cache, no-store, max-age=0, must-revalidate`, `Content-Language` as proxy.ts sets it (none under `/api`) |
| `/memes/<none>`, `/collections/<none>` | 404, `(missing)/not-found.tsx` through `/missing-public-meme`, `s-maxage=31536000` |
| `error.tsx` (default, `[locale]`, admin, my, submit, meme-cards), `global-error.tsx` | 500 with Next's error document when a render throws; no path of their own |
| `loading.tsx` (31 files) | a streamed fallback inside a 200; this is why proxy.ts answers unknown slugs itself |

## 5. Per request

| Item | Next |
| --- | --- |
| `Vary` | `rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch` on route handlers and pages; `, Accept-Encoding` on pages and compressible files |
| `x-nextjs-cache`, `x-nextjs-prerender`, `x-nextjs-stale-time` | on prerendered answers; read by Next's client and nothing else |
| `Cache-Control` defaults | dynamic page `private, no-cache, no-store, max-age=0, must-revalidate`; ISR page `s-maxage=<revalidate>, stale-while-revalidate=...`; force-static route `s-maxage=31536000` |
| ETag | strong on prerendered HTML, weak on files, none on dynamic answers |
| compression | gzip of pages and files when allowed; route handler bodies are not compressed; Caddy has `encode gzip` in front |
| `HEAD` | same headers, no body |
| `OPTIONS` | dynamic route handler: 204 `allow: <methods>, OPTIONS`; static route handler: 405; page: 400, empty |
| other method | dynamic route handler: 405, empty, no `Allow`; static route handler and metadata files: 405 `Method Not Allowed` with `Allow: GET`, `Allow: HEAD`; page: rendered (200 for `POST /about`); public file: 500 |
| RSC | `RSC: 1` without the matching `_rsc` query: 307 to `<path>?_rsc`; with it, a React payload. A Next client that gets HTML for an RSC request does a full navigation instead |
