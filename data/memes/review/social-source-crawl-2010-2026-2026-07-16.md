# Social source crawl — 2010–2026 (2026-07-16)

Review-only candidates for Korean catalog memes (origin years 2010–2026) from
YouTube Shorts, Instagram, and TikTok. Nothing in this batch is auto-published.

## Scope

- Catalog seed: `data/memes/verified` (1,627 titles in 2010–2026)
- Collectors extended year allowance from 2000–2020 to **2000–2026**
- Platforms: YouTube Shorts (public search), Instagram (DDG + public discovery),
  TikTok (Newsroom + public discovery oEmbed). No login, challenge bypass, or
  video download.

## Results

| Source | File | Rows | Notes |
| --- | --- | ---: | --- |
| YouTube Shorts | `youtube-shorts-source-candidates-2010-2026-merged-2026-07-16.jsonl` | 344 | 43 titles, all years 2010–2026 |
| YouTube Shorts oEmbed | `youtube-shorts-oembed-verified-2010-2026-2026-07-16.jsonl` | 25 | high-priority enrich |
| Instagram (DDG) | `instagram-oembed-candidates-2010-2026-2026-07-16.jsonl` | 6 | stopped on DDG challenge |
| Public discovery | `social-discovery-candidates-2010-2026-2026-07-16.jsonl` | 61 | IG 34 + TikTok 27; 24 title-mapped |
| TikTok Newsroom 2023 | `tiktok-newsroom-candidates-2023-2026-07-16.jsonl` | 49 | unmapped editorial |
| TikTok Newsroom 2024 | `tiktok-newsroom-candidates-2024-2026-07-16.jsonl` | 18 | unmapped editorial |

Ranking refresh: `data/memes/review/social-source-ranking-2010-2026-2026-07-16.jsonl`
(all collected social files; triage only).

## Constraints observed

- YouTube rate-limited after ~10 rapid queries; resumed with `--delay=2500` and retries.
- DuckDuckGo challenged Instagram/TikTok HTML search after a few queries; no bypass.
- TikTok Korea music Year-on-TikTok page had no embeddable video URLs.
- Pre-2017 TikTok coverage is naturally sparse (platform era).

## Next human review

1. Prefer Shorts rows with oEmbed + title/channel match.
2. Treat Newsroom and unmapped discovery as discovery only until catalog match.
3. Confirm rights before any `meme_contents` / `meme_sources` promotion.
