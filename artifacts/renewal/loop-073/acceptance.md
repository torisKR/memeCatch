# Loop 073 acceptance — Global Localized Meme Card Export

## Product contract

- `/en|ja|zh|zh-tw/memes/[key]` shows the existing card export action.
- The active SEO locale is passed to the existing `/memes/[key]/export` server route.
- Korean and UI-only locales keep the existing canonical Korean export path.
- The server accepts only public `approved`/`limited` memes and, for a locale request, an exact `reviewed` translation with complete required fields whose `source_updated_at` matches the meme `updated_at`.
- Missing, machine, stale, or incomplete localized content returns `404`; Korean fallback is forbidden for a localized request. Unsupported locale query values return `400`.
- Existing entitlement rules remain authoritative: free users can use the existing classic/card export, while premium template, story format, high resolution, and watermark removal remain Plus-gated.

## Response and security contract

- Success is an `image/png` attachment with `private, no-store`, the resolved `Content-Language`, `Vary: Cookie`, and `X-Content-Type-Options: nosniff`.
- Error responses are JSON with `private, no-store` and `nosniff`.
- The client never supplies title, summary, safety, lifecycle, or entitlement facts to the server.
- No new migration, database write, service-role path, external AI call, automatic publication, or source-media copy is introduced.

## Stop boundary

This artifact proves local code and public unauthenticated classic/card behavior. It does not approve production deployment, migration application, or authenticated Plus premium-option QA.
