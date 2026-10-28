# Local meme detail / structured data re-audit — 2026-10-18

## Scope and result

- Target: `http://127.0.0.1:3020/memes/2au7br9f-도마도마-챌린지` (the browser's URL uses the percent-encoded slug).
- Local changes and verification only. No deployment, production DB migration/write, video upload, publication, external account change, or new dependency.
- Existing branch and unrelated uncommitted work preserved.
- Used the `schema` skill and the installed Next 16.3.4 JSON-LD guide. Native server-rendered JSON-LD and `<` escaping remain unchanged.

## Actual rendered page comparison

After a full reload, the rendered DOM contains exactly one each of Organization, WebPage, DefinedTerm, and BreadcrumbList. The JSON parses successfully.

| Check | Observed result |
| --- | --- |
| H1, WebPage.name, DefinedTerm.name | All `도마도마 챌린지` |
| Visible one-line meaning and both schema descriptions | Identical |
| Canonical, WebPage.url, DefinedTerm.url | Identical local detail URL |
| WebPage.mainEntity and DefinedTerm.@id | Same entity |
| HTML language and WebPage.inLanguage | Both `ko` |
| Visible home / challenge / current-page breadcrumb | Matches BreadcrumbList |
| citation URLs | All 3 match links in the user-expandable reference section; expanded and checked in the browser |
| Actual iframe / VideoObject count | 0 / 0 |

The visible `2025년 무렵` is the meme's approximate origin year, not the document's publication timestamp. The schema uses stored `published_at` / `updated_at` (`2026-08-03T22:33:42.63537+00:00` for this document), not discovery time or a fabricated video upload date.

Screenshot: [expanded references](../../.local/schema-reaudit-20261018/detail.jpg).

## Change made

The global Organization description still called the service a “실시간 사전”, inconsistent with the recent evidence-scoped UI cleanup. Replaced this unsupported real-time claim with:

> 밈·유행어·챌린지의 뜻과 유래, 사용 맥락과 참고 자료를 정리하는 한국 밈 사전.

Added a regression that first reproduced this stale description and then passed after the one-line correction.

Changed files in this task (not the entire pre-existing dirty diff):

- `components/json-ld.tsx`: Organization description only.
- `components/json-ld.test.tsx`: description regression.
- `components/meme-produced-videos.integration.test.tsx`: new public-projection → server getter → actual component DOM integration tests.
- This audit record.

## VideoObject gate

The existing gate did not need relaxing or replacing:

1. DB public projection requires public visibility, site-linked status, succeeded processing, matching approved artifact hashes, embed smoke proof, approved production, valid asset rights, no reselection block, and a live/approved linked content row.
2. Latest matching completed sync/monitor observation determines `public_embed_verified`; an explicit newer failed playback observation overrides an earlier success.
3. Server getter accepts only the current meme's public rows with valid video identity. It only parses schema metadata when the proof is exactly boolean `true`.
4. JSON-LD again requires `privacy_status === "public"`, `public_embed_verified === true`, a valid 11-character YouTube ID, real title/thumbnail/upload datetime, matching thumbnail video ID, and an indexable detail opt-in.
5. The rendered player and VideoObject use the same `producedVideoEmbedUrl` helper. The visible title/description use the parsed metadata that produces the schema.

Integration tests cover the positive case and exclude private/unlisted visibility, false/missing/string/numeric proof, missing name, another video's thumbnail, a future upload datetime, invalid video ID, database errors and non-indexable detail opt-out. Existing unit tests additionally cover missing required fields, malformed calendar dates, timezone requirements, unsafe thumbnail URLs, duplicates, and XSS escaping.

A valid public projection row with failed/missing schema proof can still have a visible iframe; it does **not** emit VideoObject. This existing display contract was preserved because this request restricts structured data, not all visible public players.

## Fresh verification

- Vitest: **7 files, 103 tests passed** (JSON-LD, produced-video component, new integration, public server getter, Korean and localized detail contracts/metadata).
- Node fixture tests: **39 passed, 0 skipped** (metadata parser, worker, official iframe playback-probe protocol).
- Real disposable local PostgreSQL: **1 test passed, 0 skipped; 11 visibility checks passed** using the actual SQL view and rights validator. Includes latest false proof, private/unlisted hiding, wrong hash, unapproved content/production, invalid rights, anonymous grants and idempotent forward migration.
- PostgreSQL initially could not allocate shared memory inside the sandbox. The same temporary Unix-socket-only test passed with the required local permission; it never read application credentials or connected to production. The temporary server was stopped by the test.
- `pnpm exec tsc --noEmit --incremental false`: passed.
- ESLint on the 3 changed code/test files: passed.
- `git diff --check`: passed.
- Browser reload: corrected Organization description present; all table comparisons above returned true.

## Explicit limits / remaining operational considerations

- The current page has no playable iframe. The positive playback-to-schema path was tested with fixtures, **not** a newly played live YouTube production. Nothing was uploaded or made public to manufacture a positive example.
- Existing embed probes require actual IFrame API playback and advancing playback time, correct video identity and artifact hash; ready-only, frozen, paused, and error cases fail the fixture tests. These tests validate the protocol, not current remote availability.
- No automatic proof TTL exists in the current projection. Remote deletion/privacy changes are reflected after monitor/reconciliation observes them; monitor failure/absence is not proof of continued remote availability. No new expiry policy or migration was invented in this narrow re-audit.
- This localhost session blocks external writes. View/analytics failures caused by that guard and unrelated media-ledger/thumbnail failures are not a zero-console-error claim or a production diagnosis.
- Google Rich Results Test / Search Console validation was **not executed** in this task. Local DOM and fixtures are not Googlebot or indexing proof. No public staging or production deployment was used.

Google's [VideoObject guidance](https://developers.google.com/search/docs/appearance/structured-data/video) documents the metadata requirements; its [general structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) require accurate, page-representative content. [Video SEO guidance](https://developers.google.com/search/docs/appearance/video) separately covers discoverability and watch-page eligibility. Passing these local checks does not guarantee video indexing or rich-result display.

## Rollback

Revert only this task's Organization description line and added description regression; remove the new integration test and this report if unwanted. Do not reset the existing dirty tree or discard earlier schema/UI/pipeline edits. No infrastructure or data rollback is required.
