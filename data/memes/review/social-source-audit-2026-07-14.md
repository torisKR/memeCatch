# Social source audit — 2026-07-14

## Production state

- Public memes: 3,115 (`approved`; `limited` was 0 at audit time)
- Pending 2000–2020 review records: 1,001
- Public regular YouTube contents: 1,509 distinct memes
- Public rights-holder YouTube Shorts: 4 rows across 2 distinct memes
- Public TikTok and Instagram rows: 0

The Explore filter and card badges reflect only published `meme_contents`, so a
zero count is intentional until a source passes review.

## Candidate coverage

| Platform | Candidate rows | Distinct meme titles | High-priority rows |
| --- | ---: | ---: | ---: |
| YouTube | 1,963 | 150 | 185 |
| YouTube Shorts | 748 | 74 | 13 |
| TikTok | 7 | 1 | 2 |
| Instagram | 3 | 1 | 2 |

The ranking pass produced 202 high-priority rows across 47 distinct meme titles.
It is triage only. Title overlap or a successful oEmbed response does not prove
that a post is the original work or an authorized upload.

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
