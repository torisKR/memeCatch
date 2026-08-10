# Loop 074 acceptance — Plus Daily Share Pack

## Product contract

- Active Plus users see a share action only for Daily Signal candidates that are public `approved`/`limited`, `rising`, green/yellow, and backed by a current reviewed content record.
- `shareReady` requires non-empty reviewed/current `title`, `summary`, `description`, and `origin` from the selected `dailySignalLocale` record. Incomplete candidates remain visible as signals but have no share CTA.
- The share pack uses only the candidate's reviewed title, summary, usage note, caution, safety level, rising state, localized detail path, and same-origin localized export path.
- The export request uses `minimal` + `card` + `scale=1`; the server remains the authority for Plus entitlement, public moderation, locale validity, translation completeness, and source revision.
- Browsers with file Web Share support receive the PNG and localized share text in the OS share sheet. Other browsers copy the localized caption/safety text and download the PNG from the same user gesture.

## Security and side-effect contract

- The client does not send title, summary, safety, lifecycle, entitlement, user id, or private note to the export route or an external API.
- 402, 404, and 503 export responses do not open a share sheet and do not trigger fallback download.
- No external SNS POST, OAuth, automatic publication, background queue, new migration, database write, service-role path, or credential change is introduced.
- Card labels use the server-side locale map for `ko`, `en`, `ja`, `zh`, and `zh-tw`.

## Stop boundary

This artifact proves local code, unit/targeted tests, production build, signed-out entitlement/error boundaries, and public localized PNG HTTP behavior. It does not approve production deployment or authenticated mobile OS share-sheet QA.
