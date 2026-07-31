# Quaternary Instagram · TikTok paths — 2026-07-16

## Why another path

DDG, Bing, and Google SERP were challenge-blocked. Newsroom year pages no longer
expose archive year reliably. This path uses **Firecrawl page scrape** of public
editorial/meme pages and search dumps, then oEmbed + hashtag rules.

## Pipeline

1. Firecrawl scrape KYM challenge pages / residual search JSON
2. Extract final `tiktok.com/@…/video/…` and `instagram.com/(reel|p|tv)/…`
3. Dedup production URLs
4. oEmbed verify
5. Map with hashtag rules (e.g. `#깡챌린지` → `1일1깡 챌린지`)
6. Insert `meme_contents` + `meme_sources` (non-representative unless sole media)

Script: `scripts/collect-quaternary-social-candidates.mjs`

## Production insert this run

| Meme | Platform | Account | Note |
| --- | --- | --- | --- |
| 1일1깡 챌린지 | TikTok | @rain.xix (RAIN) | `#깡챌린지 #GangChallenge` oEmbed |

Public totals after: TikTok **257**, Instagram **51** (approx).

## Not auto-inserted

- Instagram reels whose captions only say generic `#릴스 #챌린지` (no catalog title)
- Unrelated TikTok dance clips without matching hashtags

Those stay in `quaternary-oembed-2026-07-16.jsonl` / `quaternary-ig-meta-2026-07-16.jsonl` for review.
