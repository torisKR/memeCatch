# Instagram extra collection — 2026-07-17

## Why

Instagram lagged TikTok badly (51 vs 407). This pass is **Instagram-only**:
Firecrawl search for `site:instagram.com/reel|p`, article harvest, public oEmbed.

## Pipeline

1. Firecrawl 23 Instagram-focused queries
2. Extract `/reel/` `/p/` `/tv/` URLs (+ article HTML)
3. Instagram oEmbed (`graph.facebook.com/.../instagram_oembed`)
4. Match via **search snippet titles** (oEmbed captions often empty)
5. Insert non-representative contextual embeds

## Production inserts (10 Instagram)

| Meme | Account / note |
| --- | --- |
| 하입보이 챌린지 | NewJeans reel |
| 밤양갱 챌린지 | 비비 (BIBI) |
| 아무노래 챌린지 | Zico/Hwasa anniversary reel |
| 리사 다리 밈 챌린지 | LALISA with JISOO |
| 병뚜껑 챌린지 | Mariah Carey |
| 아이스버킷챌린지 | ALS ice bucket reel |
| 마네킹 챌린지 | Rae Sremmurd / mannequin |
| 원칩챌린지 | Paqui one chip |
| 웬즈데이 댄스 챌린지 | Wednesday dance |
| 오징어게임 달고나 챌린지 | Nick DiGiovanni |

## Notes

- ~439 IG URLs attempted; many oEmbed 400 (deleted/private)
- Successful oEmbed often returns empty `title`/`author`; SERP titles used for mapping
- Instagram remain harder than TikTok for auto-caption match

## Artefacts

- `data/memes/collected/instagram-extra-oembed-2026-07-17.jsonl`
- `data/memes/review/instagram-extra-promotions-2026-07-17.jsonl` / `.sql`
