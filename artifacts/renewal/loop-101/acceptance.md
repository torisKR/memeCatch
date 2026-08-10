# Loop 101 acceptance

## Vertical

Reviewed Localized Explore v1: `/{locale}/explore` is a strict, server-rendered
discovery deck for `en`, `ja`, `zh`, and `zh-tw`. It exposes only exact-locale
reviewed/current translations whose Korean source passes `isIndexableMeme`.

## Acceptance criteria

- Each SEO locale route returns 200 and renders locale-specific HTML, title,
  description, canonical, document language, card copy, and localized detail hrefs.
- A locale is `active` only when at least 24 eligible cards are available.
  Fewer eligible cards are `coverage-empty` and noindex; a read failure is
  `unavailable` and noindex. Empty and unavailable are not conflated.
- Machine, stale, wrong-locale, incomplete, source-stale, thin, non-public, and
  non-indexable rows never appear in the localized deck. Korean fallback cards
  are not emitted under localized explore URLs.
- Query variants keep the default self-canonical and are `noindex, follow`.
- Only locales with at least 24 eligible rows are added to localized explore
  sitemap entries and their reciprocal language map. Robots continues to allow
  the route.
- Desktop and mobile discovery links use the localized explore path when a
  locale-specific route exists. Korean `/explore` remains unchanged.
- Plus Global Scout loads the same source-depth fields and rejects sources that
  would fail the public detail depth gate, without changing its 5-card,
  safety/lifecycle, locale, or entitlement behavior.
- No production write, migration apply, translation generation/publication,
  OpenAI call, deploy, push, or merge is performed.
