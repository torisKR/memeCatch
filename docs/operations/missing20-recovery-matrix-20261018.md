# Missing 20 media-recovery matrix — 2026-10-18

## Scope and authority

This is a local read-only reconciliation of
`artifacts/release/20261018-media-recovery/missing20-live-stored-state.json`.
At `2026-10-18T10:13:12.217269Z`, production stored state selected 1,195
published, approved/limited, non-phrase `media_type=video` parents; 20 lacked
an approved live video/embed child.

No provider call, database write, source approval, upload or deployment occurred.
The stored `public_status`, `embeddable`, `removed_at`,
`metadata_refreshed_at`, and child state are historical values read from the
database, not a fresh provider-metadata or iframe-playback result. They do not
prove current availability, ownership, rights, region behavior, or semantic fit.

The precise source/video identifiers and all 20 rows are in
`artifacts/release/20261018-media-recovery/missing20-recovery-matrix.json`.

## Current stored-state partition

| Stored state | Count | Exact short IDs | Smallest valid next action |
| --- | ---: | --- | --- |
| No source | 1 | `2au7br9f` | Find or accept an exact source URL, then submit it to pending review. |
| Removed | 3 | `2ctjk9t6`, `345hhqyt`, `bwftje7h` | Keep dead children suppressed; replace only after normal source checks. |
| Region blocked | 3 | `7yaqepcn`, `f384zwnp`, `yp9aj4pw` | Revalidate or replace for target-region playback. These are **blocked child rows**, not missing projections. |
| Unlisted plus unembeddable | 3 | `2j5tfqq7`, `7rnbewq7`, `xt52qg4j` | Keep suppressed; do not revive historic URLs. |
| Public plus unembeddable | 10 | `329w7u7p`, `8p3fcz5u`, `b8afwf9w`, `d2ze7jfj`, `ffjhxs94`, `sdvd764t`, `t9s6aved`, `tb585jvk`, `wgc93agj`, `zxv52pbd` | Find a new exact source and pass the normal review gates. |

The partition is non-overlapping and totals 20. The earlier “projection repair”
designation was corrected: `7yaqepcn` and `f384zwnp` already possess
`region_blocked` child rows, so applying missing-projection repair would not
restore a playable target-region child.

## Separate candidate and semantic gates

- `zxv52pbd` has research lead `jeqdYqsrsA0`, but it is not approved. It requires
  scoped raw metadata, semantic fit, actual embed playback, rights review and
  explicit operator approval first.
- `yp9aj4pw` must use footage that actually shows original SHINHWA *Wild Eyes*
  chair choreography. Generic audio, a non-choreography MV, and other-act covers
  are unsuitable.
- `t9s6aved` needs an exact SBS sketch. A current Na-molla Family clip or
  interview is not a replacement.

## One-child recovery path

```text
exact source or existing source target
  -> scoped raw metadata + actual target-region embed playback
  -> semantic and rights review
  -> pending source if the source is new
  -> explicit operator approval
  -> approved live child/projection
```

For region-blocked rows, first choose revalidation or replacement; it is not a
projection-repair operation. This document authorizes none of the external or
operator actions above.

## Evidence boundary

- `artifacts/release/20261018-media-recovery/missing20-live-stored-state.json`
- `artifacts/release/20261018-media-recovery/production-readonly-recheck.json`
- `artifacts/release/20261014-media-recovery/READ-ONLY-AUDIT.md`
- `docs/operations/media-replacement-research-20261014.md`

The separate 127 text/image classification-review candidates and 36 already
published classification warnings are outside this exact 20-parent cohort.

## Subsequent bounded provider evidence (separate from the stored-state audit)

The user later authorized exactly one five-ID `videos.list` request. It completed
at `2026-10-18T10:17:08.310Z`; the original read-only classification above did not
itself perform that request or update any stored source row.

- `yp9aj4pw` / `gFT1mEtk3VA`: public and embeddable, but KR is explicitly in
  `regionRestriction.blocked`. This is region restriction, not private/deleted.
- `zxv52pbd` / `BbMwihl693s`: public but `embeddable=false`.
- `t9s6aved` / `lEsn-xANds0`: public but `embeddable=false`.
- Candidate `jeqdYqsrsA0`: public/embeddable; returned channel is 1theK and title
  is the IU Good Day MV. A separate anonymous player check measured initial time
  progression, but complete semantic/rights/operator review remains outstanding.
- Separate existing pending channel candidate `PRHgGhd7nW8`: public/embeddable;
  exact channel ID matches the user's channel. Initial anonymous player time
  progression was measured; pending/unknown-rights state was not changed.

Evidence: `youtube-five-approved-once/result.json` and
`candidate-anonymous-playback.json` in the same 20261018 media-recovery artifact
folder. The raw metadata's refresh/delete deadline is
`2026-11-17T10:17:08.310Z`. The single-call approval is consumed; do not retry it.
No missing child was restored by these read-only observations.
