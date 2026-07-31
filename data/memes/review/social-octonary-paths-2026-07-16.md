# Octonary Instagram · TikTok paths — 2026-07-16

## Why another path

After septenary (~207 challenges still missing TT/IG). Target next wave of
popular challenges: Permission to Dance, aespa series, RIIZE, TWS, Stray Kids,
SEVENTEEN, JENNIE Mantra, G-DRAGON POWER, etc.

## Pipeline

1. Firecrawl search (41 queries)
2. Article harvest + direct URLs
3. oEmbed (~81 TikTok candidates)
4. Strict hashtag/title match + context guards
5. Drop false maps (e.g. TEN Nightwalker ≠ 밤양갱)
6. Prefer official accounts; insert non-representative embeds

## Production inserts this run

**36 TikTok** contextual embeds (examples):

| Meme | Account |
| --- | --- |
| BTS Permission to Dance 챌린지 | BTS official |
| Mantra 챌린지 | JENNIE |
| POWER 챌린지 | BIGBANG official |
| Whiplash / Spicy | aespa official |
| RIIZE Boom Boom Bass / Fly Up | RIIZE |
| TWS 따름 / 앙탈 | TWS |
| 특(S-Class) / LALALALA | Stray Kids |
| 손오공 / THUNDER / 파이팅 해야지 | SEVENTEEN |
| ENHYPEN Bad Desire | ENHYPEN |
| IVE Eleven | IVE.official |
| 클락션 | i-dle official |
| How You Like That | BLACKPINK |
| Bubble Gum / ETA | NewJeans |
| One and Only | BOYNEXTDOOR |
| + Super Lady, Queendom, CAKE, HEYA, Impossible, Batter Up, Running Man, Silhouette, Doodle, Slickback, IU lilac/celeb, Drama, Next Level, NMIXX LMLT, etc. |

Public totals after: TikTok **328**, Instagram **51** (approx).

## Rejected

- `#Nightwalker` (TEN) → not `밤양갱 챌린지` (BIBI)
- Weak silhouette typo tags without clear challenge signal (first pass)

## Artefacts

- `data/memes/collected/octonary-oembed-2026-07-16.jsonl`
- `data/memes/review/octonary-promotions-2026-07-16.jsonl` / `.sql`
