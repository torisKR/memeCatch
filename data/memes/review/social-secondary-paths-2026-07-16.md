# Secondary Instagram · TikTok paths — 2026-07-16

Review-only collection that **avoids duplicating** DDG search, Newsroom, and
Firecrawl index-seed batches. URLs already in production `meme_contents` or
prior collected jsonl are skipped.

## Paths

| Path | Signal | Notes |
| --- | --- | --- |
| namu.wiki individual challenge/meme pages | `namu_individual_page` | Not the period hub alone |
| knowyourmeme.com articles | `know_your_meme` | Public citation pages |
| curated wiki/media (when listed) | `wikipedia_citation` / `editorial_media` | HTTPS only |

Script: `scripts/collect-secondary-social-candidates.mjs`

## Results

| Metric | Value |
| --- | ---: |
| Pages attempted | 71 |
| oEmbed-verified candidates | **113** |
| TikTok / Instagram | 93 / 20 |
| Skipped duplicates | 1 |
| Catalog title_overlap | 20 |

Output: `data/memes/collected/secondary-social-candidates-2026-07-16.jsonl`

## Contextual promotion (strict gate)

After `prepare-contextual-social-promotions` + manual drop of one weak match
(아기상어 / Brawl Stars false positive):

| Meme | Platform | Account |
| --- | --- | --- |
| 치킨조키 밈 | TikTok | @salesmenpod |
| 트랄라레로 트랄랄라 | TikTok | @tordex0p |

Applied to production as non-representative contextual embeds (`embeddable` sources).
Previous batch of 5 promotions left unchanged.
