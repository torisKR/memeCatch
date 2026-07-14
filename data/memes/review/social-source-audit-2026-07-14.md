# Social source audit — 2026-07-14

## Production state

- Public memes after limited promotion: 4,115 (`approved` 3,115 + `limited` 1,000)
- Remaining pending 2000–2020 review records: 1 duplicate variant
- Public regular YouTube contents: 1,509 distinct memes
- Public rights-holder YouTube Shorts: 4 rows across 2 distinct memes
- Public TikTok contextual embeds: 2 rows across 2 distinct memes
- Public Instagram contextual embeds: 1 row across 1 distinct meme

The Explore filter and card badges reflect only published `meme_contents`.
TikTok and Instagram are deliberately labeled as related usage/context examples,
not as original or representative uploads.

The 1,000 limited records are now visible in Explore with context-source badges
and caution states. Production verification found 1,000 rows in the 2000–2020
range, zero missing `published_at`, zero missing “추가 검수 중” cautions, and the
single remaining pending title `Mundial Ronaldinho Soccer 64`.

## Candidate coverage

| Platform | Candidate rows | Distinct meme titles | High-priority rows |
| --- | ---: | ---: | ---: |
| YouTube | 1,963 | 150 | 185 |
| YouTube Shorts | 748 | 74 | 13 |
| TikTok | 15 | 9 | 2 |
| Instagram | 3 | 1 | 2 |

The ranking pass produced 202 high-priority rows across 47 distinct meme titles.
It is triage only. Title overlap or a successful oEmbed response does not prove
that a post is the original work or an authorized upload.

The TikTok set now also includes eight live posts cited by TikTok's official
2019 Top 100 Newsroom article. Ten canonical video URLs were present in the
article; eight still passed public oEmbed verification and two returned HTTP
400, so the latter were excluded without retry or bypass. The eight live rows
remain `catalog_match_status = unmapped` and low priority until an editor maps
them to an existing CatchMeme record and checks rights. The ranking explicitly
prevents an oEmbed caption from matching itself and inflating the score.

Three exact-match contextual candidates were promoted after their public embed
metadata was reverified: TikTok examples for `Bad Guy (Billie Eilish song)` and
`심쿵`, and an Instagram context reel for `검정고무신 애니메이션`. All three are
stored with `is_representative = false`, `source_role = contextual_derivative`,
and `rights_basis = platform_public_embed`. The detail UI therefore uses
“사용 예시 / 관련 콘텐츠 / 게시물 보기” wording and never calls them the original.

## Manual spot check

Five top official-broadcaster candidates were compared against production:

- 개그콘서트 달인
- 개그콘서트 마빡이
- 거침없이 하이킥 야동순재
- 박지윤 '성인식'
- 얼마면 돼(가을동화)

All five already had a playable official-broadcaster YouTube representative and
a YouTube source row. No database change was needed.

The expanded Shorts review then verified four scene-matching uploads from the
rights-holder channel `KBS COMEDY: 크큭티비`: one for `개그콘서트 달인` and
three for `개그콘서트 마빡이`. They were added as non-representative, live,
approved embed contents with `embeddable` source records. The public Shorts
filter therefore covers two distinct memes without replacing their long-form
representatives.

Nineteen other high-priority meme titles had no playable content row. Manual
inspection showed that the leading results were mostly later news reports,
retrospectives, unrelated namesakes, or derivative social posts. They remain in
review instead of being promoted under the misleading label “original
content.”

## Promotion gate

A candidate can become a published source only when an editor confirms all of
the following:

1. The URL is a direct public post, not a search, wiki, or redirect page.
2. The content is the original work or an authorized official upload.
3. Its title and scene match the CatchMeme record, not merely a shared keyword.
4. The platform's oEmbed/player still resolves.
5. Rights and availability are recorded before `meme_contents` is created.
