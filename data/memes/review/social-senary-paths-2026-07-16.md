# Senary Instagram · TikTok paths — 2026-07-16

## Why another path

Continue after quinary (media search + Wikipedia). This pass **targets catalog
challenges that still lack TikTok/Instagram**, with Firecrawl queries per meme
and official/account-linked posts.

## Pipeline

1. Firecrawl search per missing challenge (Soompi / Allkpop / Koreaboo / open web)
2. Extract article + direct post URLs
3. Public oEmbed
4. **Strict** catalog match only when:
   - oEmbed title contains the full catalog title, or
   - a high-confidence hashtag maps to exactly one catalog title
5. Insert non-representative contextual embeds

## Production insert this run

| Meme | Platform | Account | Signal |
| --- | --- | --- | --- |
| GGEZ 챌린지 | TikTok | 틱톡맨 | title `GG EZ 챌린지` / `#ggez` |
| 마네킹 챌린지 | TikTok | 케찹 (@ccatch_upp) | full `마네킹 챌린지` |
| 마마무 딩가딩가 챌린지 | TikTok | mamamoo_official | `#dinggachallenge` |
| 병뚜껑 챌린지 | TikTok | Declan McKenna | `#bottlecapchallenge` |
| 삐끼삐끼 챌린지 | TikTok | BLITZERS | full `삐끼삐끼 챌린지` |
| 아이스버킷챌린지 | TikTok | @soozzi921 | `#아이스버킷챌린지` |
| 원칩챌린지 | TikTok | TyBott | `ONE CHIP CHALLENGE` |

Public totals after: TikTok **266**, Instagram **51** (approx).

## Artefacts

- `data/memes/collected/senary-oembed-2026-07-16.jsonl`
- `data/memes/review/senary-promotions-2026-07-16.jsonl` / `.sql`
- Work: `data/memes/collected/.work/senary-fc*`

## Rejected (not inserted)

- Nick & Judy cosplay posts mis-mapped to unrelated group challenges via weak aliases
- ENHYPEN `#FuturePerfectChallenge` → wrong catalog title
- GIDLE `#ohmygodchallenge` → ambiguous vs `OMG 챌린지` / 뉴진스 OMG
