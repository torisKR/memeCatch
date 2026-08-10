# GLO-004 acceptance criteria — localized submission flow

1. `/submit`, its loading/error boundaries, the form, content-link preview, TikTok import outcomes, and the submission-success state render active-locale copy for every supported UI locale.
2. Server-side submission validation and server-action errors use the request locale, without trusting a locale submitted by the browser.
3. The existing trust boundaries remain unchanged: authentication still precedes the RPC, supported oEmbed URLs are rechecked server-side, attachment paths remain restricted to the authenticated user's prefix, and TikTok's OAuth callback/safe-return behavior is untouched.
4. Existing submission semantics stay intact: the feature flag closes submissions, the Zod limits and HTTPS URL rule remain, rate-limit/RPC error mappings remain, client upload validation still enforces the same MIME and 5MB limits, and public TikTok videos only enter the review queue.
5. The change adds no database write outside the existing user-triggered submission/upload flow, no schema or migration, no new locale-prefixed route, no analytics event, and no production operation.
6. Focused regression tests prove full locale-copy fallback/no Korean leakage plus the localized pending badge; full test, lint, type, build, and diff checks pass.
