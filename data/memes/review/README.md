# Pending review records

`wikimedia-2000-2020-pending-2026-07-14.jsonl` contains 1,001 public-reference
records for memes originating from 2000 through 2020. They have been inserted
into the remote `memes` table with `moderation_status = 'pending'`.

They are intentionally not public search or explore records. A linked
Wikipedia page is only a context reference; each entry still needs an editor to
verify its source year, an original upload or primary source, local relevance,
and rights before the normal moderation workflow can promote it.

The companion `.errors.json` file records the one discovery candidate that had
no usable Wikimedia introduction and was therefore not staged.

`social-source-ranking-2026-07-14.jsonl` ranks the review-only social candidates
already collected for existing memes. The score is only a triage signal based
on title/alias overlap, official-channel hints, derivative-content hints, and
public oEmbed verification. It never changes `review_status` and must not be
used as automatic publication approval.

`tiktok-newsroom-candidates-2019-2026-07-14.jsonl` is a separate discovery set
from TikTok's official 2019 Top 100 Newsroom article. It contains eight canonical
posts that still pass public oEmbed verification. They are intentionally marked
`catalog_match_status = unmapped`; an editorial mention verifies discovery, not
CatchMeme title matching, originality, or publication rights.

`official-social-promotions-2026-07-14.jsonl` is the much smaller promotion
ledger. Every row has a canonical Shorts URL, public oEmbed verification,
scene-title match, and confirmed rights-holder channel. The idempotent SQL
generator refuses rows without both `rights_holder_confirmed = true` and
`promotion_status = approved`.
