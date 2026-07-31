# Tertiary Instagram · TikTok paths — 2026-07-16

## Paths (new)

| Path | Script / method | Notes |
| --- | --- | --- |
| Bing HTML search | `collect-tertiary-social-candidates.mjs` | Challenged immediately this run |
| Reddit public `.json` | same | Few final post URLs |
| Work-dir residual URLs | same | 14 Instagram oEmbed |
| New KYM / namu articles | `collect-secondary-social-candidates.mjs` | 29 new (not in prior secondary batch) |
| Firecrawl scrape of KYM | manual + oEmbed | 31 verified posts |

All paths dedupe against production `meme_contents` URLs + prior collected jsonl.

## Production inserts (this run)

5 new TikTok contextual embeds (after weak-compile filter):

| Meme | Accounts |
| --- | --- |
| 이탈리안 브레인롯 | @privat.pribat, @gof_history_no1 |
| 트랄라레로 트랄랄라 | @duck.editsxzz, @kintaro.ae, @matias_v77 |

Applied via `tertiary-bulk-promotions-2026-07-16.sql` (idempotent).  
Detail UI already shows “관련 TikTok·Instagram” for non-representative embeds.
