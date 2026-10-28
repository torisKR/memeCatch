# Read-only recovery reconciliation — 2026-10-18

## Exact approved reference: already activated, not repeated

The user's approval applies only to `PRHgGhd7nW8` as a Whiplash secondary
performance/choreography reference. It does not authorize other source approval,
challenge-origin attribution, independent-spread claims, downloads or uploads.

A fresh read-only production DB query at `2026-10-18T11:25:28.805894Z` confirmed:

- Target `6aa7aafc-978d-475a-b784-c0808ff6cfc0`, source
  `cc873139-b970-424f-9bb8-9200734d0630`.
- `approved / secondary_reference / official_embed`.
- Existing real-actor review/audit timestamp `2026-10-18T11:18:53.678788Z`.
- Exactly one approved/live/nonrepresentative child with the authorized caption
  and exactly one matching approval audit. No second approval was attempted.
- Stored provider observation remains `2026-10-18T10:17:08.310Z`; this DB read
  is not a new YouTube metadata observation. Stored expiry is November 17.

Fresh public HTML returned HTTP 200, included the reference section and exact
caption, retained primary `jWQx2f-CErU`, and did not include `PRHgGhd7nW8` in
any JSON-LD script. The first request queried the wrong release header name and
returned null; the corrected read at `2026-10-18T11:26:35.115Z` confirmed
`x-memecatch-release-sha: secondary-reference-2d5d886433ea`.

This follow-up made no production writes or new deployment. Earlier fresh visual
and regression evidence is separately retained in
`secondary-reference-activation-20261018.md` and the final 3/3 browser report.

## Missing-media cohort remains incomplete

Production read at `2026-10-18T11:26:06.644139Z` found 1,195 eligible documents
and 20 without approved/live video/embed children. Eligibility is published,
approved/limited, `doc_class=meme`, `media_type=video`, non-phrase category.
This is a DB delivery audit, not fresh provider status or whole-catalog semantic
certification. The new Whiplash secondary reference does not reduce this cohort
because Whiplash already has a primary video.

The exact missing short IDs remain:

`2au7br9f`, `2ctjk9t6`, `2j5tfqq7`, `329w7u7p`, `345hhqyt`, `7rnbewq7`,
`7yaqepcn`, `8p3fcz5u`, `b8afwf9w`, `bwftje7h`, `d2ze7jfj`, `f384zwnp`,
`ffjhxs94`, `sdvd764t`, `t9s6aved`, `tb585jvk`, `wgc93agj`, `xt52qg4j`,
`yp9aj4pw`, `zxv52pbd`.

## Reuse boundary found in existing code

The current URL intake always calls `getOEmbed` in
`lib/sources/ingest.server.ts` before `record_source_ingestion`. The RPC can
update a shared source's metadata. Neither the form nor admin action provides a
provider-free operation to attach an existing source to another meme as pending.

Therefore do not call URL intake under a no-new-provider-call boundary, copy a
different meme's approval, or directly create public projections. A prospective
pending-only existing-source action would require a separately tested narrow
implementation; no such feature or migration was applied in this follow-up.

## Bounded new candidate discovery and Aside evidence

The independent pass in `missing-media-origin-leads-pass2-20261018.md` used six
focused public searches and one failed official-page open. It found
`kWUsI7LCSmY` as the original-song MV candidate for Hong doctor. No singular
originating streamer/VOD was established for `329w7u7p`; no arbitrary sneeze
clip was substituted.

Aside session `jrutR1aaDRr1yqce` inspected ordinary watch pages only:

- `jeqdYqsrsA0`: rendered 1theK Good Day MV title/uploader/description support
  candidate identity. The observed player was an advertisement, not proof of
  the main MV's high-note scene. Normal visible ad-skip then exposed the main
  player at 0.211168/357.421 seconds, `seeking=false`, `readyState=4`. A later
  60-second seek remained `seeking=true`, `readyState=1` at the final observation;
  no synchronized main-MV frame or high-note scene was established. No audio
  confirmation is claimed.
- `kWUsI7LCSmY`: rendered title, uploader `더면상` / `@the_myeonsang`, and
  original production credits support the official MV candidate identity.
  DOM reported 45/114.101 seconds, `seeking=false`, `readyState=4`, but the
  screenshot visibly showed a challenge compilation and 0:08/0:30 controls.
  The parent independently inspected both captures. The discrepancy is
  unresolved; neither image is certified as the official MV's 45-second scene.

Evidence paths (ordinary browser captures, not downloaded source videos):

- `/Users/toris/.aside/u/0/sessions/2026-10-18_jrutR1aaDRr1yqce/tmp/jojubong-watch-evidence.png`
- `/Users/toris/.aside/u/0/sessions/2026-10-18_jrutR1aaDRr1yqce/tmp/jojubong-frame-check.png`

Neither candidate was ingested, approved or published. This follow-up did not
make YouTube Data API, oEmbed, transcript-helper, AI drafting, download, upload,
subscription or paid-service configuration calls. Public watch pages can make
their normal playback/advertising requests; those are not claimed absent.
Aside reported both task-owned tabs closed successfully; existing tabs were not
operated on. The task was bounded and was not extended into screenshot-tooling
diagnostics or access-restriction bypass.

Existing one-call Data API authority is consumed. Fresh exact-ID metadata
requests require a new bounded authorization; a successful raw check would
still not itself authorize public release or certify scene/rights review.
