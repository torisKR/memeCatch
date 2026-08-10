# GLO-002 acceptance criteria — localized Plus export upgrade

1. When a non-Plus user chooses a locked export option, the upsell CTA leads to the real price route for the active SEO locale: `/pricing`, `/en/pricing`, `/ja/pricing`, `/zh/pricing`, or `/zh-tw/pricing`.
2. UI-only locales continue to use the existing cookie-localized unprefixed `/pricing` route; no unsupported locale prefix is created.
3. The export close control has a localized accessible name instead of a Korean-only label.
4. The existing export entitlement enforcement, options, checkout policy, data, migrations, deployment, push, and merge are unchanged.
