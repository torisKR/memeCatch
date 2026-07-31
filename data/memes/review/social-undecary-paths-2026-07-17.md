# Undecary gap-fill — 2026-07-17

## Goal

Fetch more TikTok/Instagram for challenges still missing social embeds.

## Pipeline

1. Audit missing challenges (~113)
2. Firecrawl search (43 queries)
3. Article harvest + oEmbed (~75)
4. Strict match to **missing titles only**
5. Drop cooking-only / false maps (e.g. Dalgona cookies → SPOT)
6. Insert non-representative contextual embeds

## Inserted (20)

| Meme | Account |
| --- | --- |
| 하입보이 챌린지 | NewJeans |
| 러브다이브 / 애프터 라이크 | IVE.official |
| 정국 세븐 챌린지 | BTS |
| 리사 다리 밈 (MONEY) | BLACKPINK |
| 클락션 챌린지 | i-dle |
| 있지 스니커즈 | ITZY |
| 움파룸파 챌린지 | aespa |
| 아파트 챌린지 | ATEEZ |
| 티라미수 케이크 | SEVENTEEN |
| 바라밤 | TXT |
| + 덤디덤디, JUMP, 롤린, 모시모시, 새삥, 달고나, 무궁화(오징어게임), 포켓몬 댄스, 헤이마마 등 |

## Totals after

- TikTok **~407** / Instagram **51**
- Challenges still without TT/IG: **~93**

## Artefacts

- `data/memes/collected/undecary-oembed-2026-07-17.jsonl`
- `data/memes/review/undecary-promotions-2026-07-17.jsonl` / `.sql`
