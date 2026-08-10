# GLO-001 acceptance criteria — localized Plus conversion routes

1. `/pricing` and `/en|ja|zh|zh-tw/pricing` are real static pages; no locale prefix is generated for a static route that does not exist.
2. Each locale page has locale-matched Plus title and description, canonical URL, reciprocal `hreflang`, Open Graph locale, and English `x-default`.
3. The sitemap exposes exactly the five pricing URLs with the same reciprocal alternatives.
4. The global language selector preserves `/pricing` when selecting an SEO locale; the brand link and in-product Plus upgrade links retain the locale path.
5. UI-only locales keep cookie-localized unprefixed routes, so this change does not create unsupported `/th/pricing`-style URLs.
6. No billing policy, checkout request, production database row, migration execution, deploy, push, or merge occurs in this loop.
