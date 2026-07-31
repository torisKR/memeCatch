# Instagram · TikTok alternate collection paths — 2026-07-16

Review-only candidates. Nothing here is auto-published to Supabase.

## Why

DDG HTML search challenges quickly, and TikTok Newsroom covers only official
editorial lists. Two additional **public, login-free** paths were added so
Instagram and TikTok final post URLs can still be collected when they already
appear on the open web.

## New collectors

| Path | Script | Input | Output (this run) |
| --- | --- | --- | ---: |
| Public article / wiki citations | `collect-public-article-social-candidates.mjs` | HTTPS article URL list | 52 |
| Public-index seed oEmbed (IG+TT) | `collect-social-oembed-seeds.mjs` | Final post URL seeds | 62 |
| Instagram search expansion | `collect-instagram-oembed-candidates.mjs` | verified catalog | (query: `/reel` + `/p`) |

Shared library: `scripts/public-article-social.mjs` (URL extract + oEmbed).

## Results

| File | TikTok | Instagram | Notes |
| --- | ---: | ---: | --- |
| `public-article-social-candidates-2026-07-16.jsonl` | 44 | 8 | namu.wiki citations; all title-mapped |
| `social-index-oembed-candidates-2026-07-16.jsonl` | 46 | 16 | careet/Firecrawl snippet seeds; 3 oEmbed failures |
| Prior `social-discovery-candidates-2010-2026-2026-07-16.jsonl` | 27 | 34 | baseline |

**New unique final URLs beyond prior discovery batch: 67** (TikTok 49 · Instagram 18).

## Constraints (unchanged)

- No login, cookies, app keys, challenge bypass, or video download
- Only final `tiktok.com/@…/video/…` and `instagram.com/(reel|p|tv)/…` URLs
- oEmbed verifies public embeddability only — not originality or rights
- All rows: `review_status = needs_human_source_match`

## Matching fix (same day)

Article catalog matching initially used the **surrounding page HTML**, so long
namu.wiki pages that mention many meme names falsely tagged unrelated embeds as
`title_overlap` (e.g. 46 rows labeled `룩공절(1122)` because alias `1122`
appeared on the page). Matching now uses **oEmbed title/author only**, ignores
needles shorter than 4 compact characters and pure-digit aliases, and the
article candidate file was rematched offline (4 true overlaps / 48 unmapped).

## Contextual promotion (2026-07-16)

Strict prepare gate (`prepare-contextual-social-promotions.mjs`):

- final post URL, oEmbed verified, non-empty creator
- oEmbed text contains full catalog title or a long alias (≥6 compact chars)
- one embed per meme+platform, non-representative

| File | Rows |
| --- | ---: |
| `contextual-social-promotions-2026-07-16.jsonl` | 5 |
| `contextual-social-promotions-2026-07-16.sql` | applied to production |

Promoted TikTok contextual embeds (all `is_representative = false`,
`copyright_status = embeddable`):

1. `(여자)아이들 TOMBOY 챌린지` — @pinkfong_official
2. `간 때문이야` — @iaan_xum
3. `이탈리안 브레인로트` — @bstchld
4. `이탈리안 브레인롯` — @drinkcup3
5. `포철고 챌린지` — @yul.__2

Instagram candidates in this batch mostly lack oEmbed author/title metadata, so
none passed the promotion gate.
