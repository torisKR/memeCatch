# Yellow (맥락 주의) + empty media cleanup — 2026-07-16

## Scope

User asked to fix memes with missing preview/content, and specifically
items showing **▲ 사용 안전 신호등 / 맥락 주의** without usable media:
find content or delete.

## Actions

| Action | Count |
| --- | ---: |
| Yellow approved memes with no approved `meme_contents` (before) | 296 |
| Filled with Instagram embed | **1** (`버피 챌린지` → `instagram.com/reel/DF6dSluSfdD/`) |
| Deleted (no fillable social source) | **295** |
| Yellow no-content remaining | **0** |

Backup of deleted rows (id/title/summary only):  
`yellow-no-content-deleted-2026-07-16.jsonl`

## Not deleted

- **Green / gray / red** dictionary memes without embeds remain (text cards are valid).
- Social embeds that still oEmbed but lack card thumbnails (19 live posts) kept —
  player works on detail; thumb scrape blocked by platform.

## Public safety mix after cleanup

| safety_level | public count |
| --- | ---: |
| green | 2674 |
| yellow | 836 |
| gray | 129 |
| red | 124 |
