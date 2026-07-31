# Quinary Instagram · TikTok paths — 2026-07-16

## Why another path

Prior paths (DDG, Newsroom, firecrawl index seeds, namu/KYM articles, Bing/Reddit
workdir, KYM firecrawl scrapes) still leave Korean/global challenge memes without
contextual IG/TikTok embeds. This path uses **entertainment-media Firecrawl search**
and **Wikipedia MediaWiki API** — not SERP HTML scrapes and not login/challenge
bypass.

## Pipeline

1. Firecrawl web search on media domains (Billboard, Soompi, Allkpop, Koreaboo, RS, NME, Paper, Guardian, …)
2. Direct HTTPS fetch of result article HTML
3. Wikipedia MediaWiki `extlinks` + wikitext + `insource:` search (en/ko)
4. Extract final `tiktok.com/@…/video/…` and `instagram.com/(reel|p|tv)/…`
5. Dedup production URLs + prior collected jsonl
6. Public oEmbed verify
7. Catalog match via oEmbed title/author + high-confidence hashtag rules
8. Insert non-representative `meme_contents` + `meme_sources` (`platform_public_embed`)

Script: `scripts/collect-quinary-social-candidates.mjs`

## Production insert this run

| Meme | Platform | Account | Note |
| --- | --- | --- | --- |
| 스테이씨 파피 챌린지 | TikTok | STAYC (`@stayc_official`) | `#PoppyChallenge` oEmbed |
| 아무노래 챌린지 | TikTok | kozico0914 (ZICO) | `#AnysongChallenge` / `#아무노래` oEmbed |

Public totals after: TikTok **259**, Instagram **51**.

## Collected artefacts

- `data/memes/collected/quinary-oembed-2026-07-16.jsonl` — oEmbed candidates
- `data/memes/review/quinary-promotions-2026-07-16.jsonl` / `.sql` — applied ledger
- Work dumps under `data/memes/collected/.work/quinary-fc*`

## Not auto-inserted

- Celebrity/lifestyle clips without catalog hashtag or title signal
- Instagram oEmbed rows with empty title/author (cannot safe-map)
- Generic `#fyp` / dance posts from Rolling Stone roundups
