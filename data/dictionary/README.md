# 줄임말·요즘어 사전

CatchMeme의 **검수 전** 줄임말/신조어/요즘어 사전입니다. 밈 카탈로그(`data/memes/`)와
별도로 관리하며, 자동 공개하지 않습니다.

## 파일

| 파일 | 설명 |
| --- | --- |
| `abbreviations.jsonl` | 줄임말·신조어·요즘어 표제어 |
| `../memes/collected/careet-slang-candidates-YYYY-MM-DD.jsonl` | careet.net 원시 수집 후보 |

## 스키마

```json
{
  "term": "책없쾌",
  "aliases": [],
  "expansion": "책임 없는 쾌락",
  "definition": "…",
  "kind": "abbreviation",
  "source": "careet.net",
  "source_url": "https://www.careet.net/…",
  "origin_year": 2025,
  "review_status": "needs_human_review",
  "imported_at": "2026-07-16T…"
}
```

`kind`: `abbreviation` | `slang` | `trendy_word`

## careet.net 반영

공개 페이지만 수집합니다. `/Dictionary`는 멤버십 페이월로 무료 3건만 노출됩니다.

```sh
# 1) 후보 수집(이미 스크래핑된 .work/careet-* 기준)
node scripts/collect-careet-slang-candidates.mjs \
  data/memes/collected/.work,.firecrawl \
  data/memes/verified,data/memes/raw \
  data/memes/collected/careet-slang-candidates-2026-07-16.jsonl

# 2) 정의가 있는 항목만 사전으로 승격(카탈로그·사전 중복 제거)
node scripts/import-careet-to-abbreviation-dictionary.mjs \
  data/memes/collected/careet-slang-candidates-2026-07-16.jsonl \
  data/dictionary/abbreviations.jsonl
```
