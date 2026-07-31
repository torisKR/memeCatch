# KoCulture-Descriptions local JSONL analysis

Verified against `data/memes/raw/imported-koculture-memes.jsonl` on 2026-08-01.

## Scenario 1: input shape and distribution

- Invocation: Node.js parsed every non-empty JSONL line with `JSON.parse`, grouped by `category` and `source`, extracted a four-digit year from `date`, and normalized titles by removing whitespace and lowercasing.
- Binary observables: 503/503 lines parse; every row has exactly the five fields `title`, `content`, `date`, `category`, `source`; no blank title/content/category; 149 blank dates.
- Category counts: `phrase=445`, `image=17`, `comment=32`, `dance=6`, `song=3`, `challenge=0`.
- Source counts: `trendaword=261` (all `phrase`, no blank dates), `namuwiki=242` (`phrase=184`, `image=17`, `comment=32`, `dance=6`, `song=3`; 149 blank dates).
- Duplicate observable: eight normalized duplicate-title groups: 원영적 사고, 하지만 빨랐죠, 알잘딱깔센, Young한데? 완전 MZ인데요?, 어쩔티비, 이것 뭐에요?, 의정부고 졸업사진, 꽁꽁 얼어붙은 한강 위로 고양이가 걸어다닙니다.

## Scenario 2: current seed converter behavior

- Invocation: copied only the KoCulture file into `/tmp/memecatch-koculture-only`, then ran `node scripts/jsonl-to-postgrest.mjs /tmp/memecatch-koculture-only /tmp/memecatch-koculture-only.json` and parsed the JSON output.
- Binary observables: process exits successfully and reports `rows=495`; eight source rows are silently dropped as duplicate titles.
- Output categories: `phrase=440`, `image=16`, `comment=30`, `dance=6`, `song=3`.
- Output quality observables: all 495 rows have `media_type=image`; all 495 have blank `origin`; all 495 are automatically `moderation_status=approved`; all 495 copy the same full `content` into both `summary` and `description`.
- Year observable: 149 missing dates fall through to year 2020, producing 153 output rows with `origin_year=2020`.
- Production scope: `scripts/seed-remote.sh` passes the whole `data/memes/raw` directory to this converter, so this file is in the remote seed path, not an isolated research file.

## Scenario 3: current validator compatibility

- Invocation: `node scripts/validate-meme-import.mjs data/memes/raw/imported-koculture-memes.jsonl`.
- Binary observables: exit code 1; `records=503`, `nonNative=503`; every row fails the required `summary` check and every row fails the `year` field/range check, yielding 1,006 validation errors. With `--strict-social`, all 503 rows additionally fail direct social-source validation.
- Reason: this validator expects `summary`, numeric `year` in 2000-2020, and optionally a native `source_url`; KoCulture supplies `content`, date strings (or blank), and provenance labels in `source`.

## Recommended mapping and its safe scope

The storage enum must remain the six legacy values because the database enum is declared as `phrase,dance,song,image,comment,challenge`. The five requested display classes can be a reversible presentation/filter mapping:

| Stored category | Requested display class | Scope |
| --- | --- | --- |
| `phrase` | 밈 용어(유행어) | direct display mapping |
| `dance`, `challenge` | 챌린지 댄스 | union only at display/filter boundary |
| `song` | 노래 | direct display mapping |
| `comment` | 드라마 장면 | compatibility mapping only; requires semantic review for imported data |
| `image` | 밈 영상 | compatibility mapping only; must not imply `media_type=video` |

Do not rewrite stored `dance` to `challenge` or collapse enums during seeding; it loses reversibility and changes existing queries. Expand the five display tokens back to legacy enum filters (`challenge dance` expands to both `dance` and `challenge`).

## Core adjustment points

1. KoCulture categories are not a reliable five-class ground truth. Examples directly inspected: `comment` contains general terms such as 알빠노/단짠 and video memes such as 비둘기야 먹자, while `image` contains terms such as 귀차니즘/짱짱맨 and actual still-image memes. `image -> 밈 영상` and `comment -> 드라마 장면` are labels for legacy compatibility, not semantic recategorization.
2. Add a KoCulture-aware validation profile or normalization stage. Validate `content` as the description source, parse `date`, allow an explicit unknown year, require the category allowlist, retain `source`, report normalized duplicates, and emit a manual-review queue for ambiguous `image`/`comment` rows.
3. Do not use 2020 as an unknown-year sentinel. Keep unknown separately if schema work is allowed, or reject/quarantine those 149 rows before the existing non-null year seed path.
4. Do not default all rows to `media_type=image`; category and media type are different axes. Without an actual media/source URL, use `text` or defer publication. In particular, a requested display label of 밈 영상 is not evidence of a playable video.
5. Preserve provenance (`trendaword`/`namuwiki`) in an origin/provenance field and do not auto-approve externally imported descriptions without source URL/licensing/content review.
6. Keep `validate-meme-import.mjs` for its current 2000-2020 native-social import contract unless a named profile is added; loosening it globally would weaken existing strict-social safeguards.
