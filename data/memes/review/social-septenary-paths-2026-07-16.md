# Septenary Instagram · TikTok paths — 2026-07-16

## Why another path

Continue after senary: **233 catalog challenges still lacked TikTok/IG**. This pass
targets high-traffic K-pop / viral challenges with Firecrawl queries aimed at
official or clearly tagged posts.

## Pipeline

1. Firecrawl search (30 queries: BTS Dynamite/PTD, NewJeans, ITZY, IVE, aespa, …)
2. Direct post URLs + article HTML harvest
3. Public oEmbed (60 TikTok candidates, 0 errors on final set)
4. Strict match: full catalog title in oEmbed **or** high-confidence hashtag + context
5. Prefer official accounts when scoring
6. Insert non-representative contextual embeds
7. Fix pass: wrong Supernova/Armageddon swap, APT fan → ROSÉ

## Production inserts (26)

| Meme | Account | Signal |
| --- | --- | --- |
| (여자)아이들 LATATA 챌린지 | fan/practice | LATATA |
| (여자)아이들 퀸카(Queencard) 챌린지 | Innah Bee | `#queencardchallenge` |
| APT. 아파트 챌린지 | ROSÉ | apt (official) |
| After LIKE 챌린지 | Rein | `#whatsafterlike` |
| Armageddon 챌린지 | Ellen and Brian | aespa Armageddon cover |
| BTS Dynamite 챌린지 | BTS official | `#Dance_Dynamite` |
| Chk Chk Boom 챌린지 | Stray Kids | `#ChkChkBoom` |
| How Sweet 챌린지 | NewJeans | `#HowSweet` |
| Hype Boy 챌린지 | NewJeans | `#NewJeans_HypeBoy` |
| LOVE DIVE 챌린지 | fan tutorial | `#ivelovedive` |
| Like JENNIE 챌린지 | LE SSERAFIM | `#likeJENNIE` |
| Magnetic 챌린지 | ILLIT | `#Magnetic` |
| SHEESH 챌린지 | BABYMONSTER | `#SHEESHchallenge` |
| SPOT! 챌린지 | kozico0914 (ZICO) | `#SPOTChallenge` |
| STAYC ASAP 챌린지 | STAYC | `#ASAP_Challenge` |
| Supernova 챌린지 | ALPHA PH | `#aespaSUPERNOVA` |
| Sweet Venom 챌린지 | Merrick | `#sweetvenomchallenge` |
| TT 표정·손가락 챌린지 (트와이스) | drunkboba | `#twicett` |
| TWS 첫 만남은 계획대로 되지 않아 챌린지 | TWS | `#첫만남챌린지` |
| That That 챌린지 | PSY | `#ThatThat` |
| 뉴진스 OMG 챌린지 | NewJeans | `#NewJeans_OMG` |
| 뉴진스 Super Shy 챌린지 | NewJeans-named | `#supershy` |
| 뉴진스 어텐션 챌린지 | NewJeans | `#NewJeans_Attention` |
| 달고나커피 챌린지 | Sonny Hurrell | `#dalgonacoffee` |
| 라이즈 Get A Guitar 챌린지 | RIIZE | Get A Guitar stitch |
| 르세라핌 UNFORGIVEN 챌린지 | LE SSERAFIM | `#UNFORGIVEN` |

Public totals after: TikTok **292**, Instagram **51**.

## Artefacts

- `data/memes/collected/septenary-oembed-2026-07-16.jsonl`
- `data/memes/review/septenary-promotions-2026-07-16.jsonl` / `.sql`
- Fixes: `septenary-fixes-*.sql`
