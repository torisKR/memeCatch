# Loop 102 acceptance — LOC-017

## Vertical

Make the Plus weekly momentum brief locale-safe without changing its existing
seven-day ranking, safety, lifecycle, exclusion, or active-Plus boundaries.

## Acceptance criteria

1. Korean content keeps the current source-backed behavior.
2. Non-Korean content locales use only an exact `reviewed` translation whose
   source revision is current, required translated fields are non-empty, and
   the localized slug is usable for the detail route.
3. The original meme must remain publicly eligible (`approved` or `limited`)
   and pass the shared `isIndexableMeme` content-depth gate. Missing, stale,
   machine, incomplete, shallow, or non-public candidates are omitted; Korean
   text is never silently substituted on a non-Korean surface.
4. The weekly brief keeps deterministic KST seven-day metrics, positive delta,
   safety/lifecycle filtering, surfaced-id exclusion, and the existing item
   cap. It distinguishes unavailable data, missing localized coverage, no
   eligible candidates, insufficient metric history, and sufficient history
   with no positive change. Source query failures, including Korean source
   failures, remain unavailable instead of becoming an empty brief.
5. UI locale copy remains localized, including a dedicated Traditional Chinese
   weekly brief, and non-SEO UI locales link to the resolved English content
   route rather than a misleading Korean route. Every localized trend link
   lands on a detail page that contains the `#trend-panel-title` anchor.
6. Free/signed-out branches do not issue weekly candidate, translation, or
   metric reads; the existing active-Plus server boundary remains intact.
7. The change is read-only: no translation generation, OpenAI call, database
   write, migration application, publication, deployment, push, or merge.

## Verification

- focused weekly brief unit and component tests
- full `pnpm test`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- local production HTTP on signed-out `/premium` and a locale pricing route
