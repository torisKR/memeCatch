# Loop 073 verification — Global Localized Meme Card Export

Date: 2026-08-09 (Asia/Seoul)

## Automated evidence

| Check | Result |
| --- | --- |
| Targeted route/proxy/detail/button tests | 4 files / 27 passed |
| Full `pnpm test` | 130 files / 859 passed |
| `pnpm exec tsc --noEmit` | exit 0 |
| `pnpm lint` | exit 0; existing 7 warnings only |
| `pnpm build` | exit 0; Next.js 16.2.10 webpack; 73/73 static pages |
| `git diff --check` | exit 0 |

## Manual HTTP evidence

The production build was started locally with `next start` and queried through HTTP. The first English detail link from `/en` was:

`/en/memes/s66254dp-sticking-out-your-gyat-for-the-rizzler`

- English detail: HTTP 200, 87,478 bytes.
- `classic/card` export with `locale=en`: HTTP 200, 52,282 bytes, PNG 1200×630.
- Successful export headers included `content-language: en`, `cache-control: private, no-store`, `Vary: Cookie`, `X-Content-Type-Options: nosniff`, `content-disposition: attachment`, and `content-type: image/png`.
- `locale=fr`: HTTP 400 with `{"error":"invalid_locale"}` and private/no-store/nosniff headers.
- A sitemap meme without a current localized translation returned HTTP 404 rather than a Korean fallback image.
- `/en` itself returned HTTP 200 with `content-language: en` and the existing security headers.

## Known validation gaps

- The successful PNG path used the free `classic/card` contract. Authenticated Plus premium template/story/3x/no-watermark behavior remains covered by unit entitlement tests but was not manually observed without a test account.
- Supabase migration/RLS/RPC execution, production deploy, push, and merge were not performed.
- The existing global translation completion gate (448/1,520 rows), DQ critical findings, SEO-001 soft-404, and other prior operational gates remain open.
