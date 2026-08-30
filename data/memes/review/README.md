# Review and limited-publication records

`wikimedia-2000-2020-pending-2026-07-14.jsonl` contains 1,001 public-reference
records for memes originating from 2000 through 2020. They were initially
inserted into the remote `memes` table with `moderation_status = 'pending'`.

`wikimedia-2000-2020-limited-promotions-2026-07-14.jsonl` is the exact 1,000-row
limited-publication ledger derived from that batch. Production transitioned the
rows through `pending → fact_checking → rights_checking → limited` in one guarded
transaction. The duplicate variant `Mundial Ronaldinho Soccer 64` remains the
single pending row and is recorded in the companion `.excluded.json` file.

The resulting production state is 3,115 approved + 1,000 limited = 4,115 public
memes. All 1,000 limited rows are from 2000–2020, have `published_at`, and display
an “original and year under further review” caution. Safety classification is
918 yellow and 82 red. A linked Wikipedia page remains a context reference, not
an original upload or proof of precise origin year.

The original pending batch's `.errors.json` file records the one discovery
candidate that had no usable Wikimedia introduction and was therefore not staged.

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

`social-source-crawl-2010-2026-2026-07-16.md` summarizes the 2010–2026 Korean
catalog social crawl (YouTube Shorts, Instagram, TikTok). Companion ranking:
`social-source-ranking-2010-2026-2026-07-16.jsonl`.

`social-source-ranking-tiktok-public-oembed-2026-08-28.jsonl` ranks the 2026-08-28
public TikTok oEmbed candidates (`tiktok-public-oembed-*.jsonl`). Scores are triage
only; every row stays `needs_human_source_match` and is not a publication approval.

`tiktok-oembed-high7-review-2026-08-29.jsonl` is the agent review ledger for that
file's seven `high` rows. Passing inserts use the existing contextual promotion
SQL (`tiktok-oembed-high7-promotions-2026-08-29.jsonl` / `.sql`); they do not
flip meme moderation or claim originality.

`new-meme-discovery-2010-2026-2026-07-16.md` covers **new** challenge/trend
titles not already in verified/raw, plus Shorts candidates collected for a
seed of those titles.

`official-social-promotions-2026-07-14.jsonl` is the much smaller promotion
ledger. Every row has a canonical Shorts URL, public oEmbed verification,
scene-title match, and confirmed rights-holder channel. The idempotent SQL
generator refuses rows without both `rights_holder_confirmed = true` and
`promotion_status = approved`.

`contextual-social-promotions-2026-07-16.jsonl` (+ `.sql`) is the second
contextual TikTok/Instagram promotion batch. Rows are built by
`prepare-contextual-social-promotions.mjs` from collected candidates only when
oEmbed title/author contains the catalog meme title (or a long alias). Applied
to production as non-representative `meme_contents` + `embeddable`
`meme_sources`. See `social-ig-tiktok-alt-paths-2026-07-16.md`.

`social-quinary-paths-2026-07-16.md` documents path F (media search + Wikipedia MediaWiki)
for additional Instagram/TikTok contextual embeds.

`social-senary-paths-2026-07-16.md` documents path G (targeted missing-challenge search)
and the seven high-confidence TikTok inserts.

`social-septenary-paths-2026-07-16.md` documents path H (hit challenges still missing
social) and 26 TikTok contextual inserts.

`social-octonary-paths-2026-07-16.md` documents path I and 36 further TikTok inserts.

`social-nonary-paths-2026-07-16.md` documents path J and 41 further TikTok inserts.

`social-decenary-paths-2026-07-16.md` documents path K gap-fill and 18 further inserts.

`social-undecary-paths-2026-07-17.md` documents path L gap-fill and 20 further inserts.

`social-instagram-extra-2026-07-17.md` documents Instagram-only collection (+10 embeds).

`social-ig-tiktok-alt-paths-2026-07-16.md` documents the alternate Instagram and
TikTok collection paths (public article citations + seed oEmbed) and the
matching/promotion gate used that day.
