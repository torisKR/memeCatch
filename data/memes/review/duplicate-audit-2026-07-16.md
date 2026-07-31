# 중복 데이터 감사 보고서 — 2026-07-16

정규화 키: `scripts/meme-title-key.mjs`와 동일 (NFKC → 소문자 → `\s\p{P}\p{S}_` 제거)

## 요약 판정

| 영역 | 상태 | 비고 |
|------|------|------|
| 약어 사전 vs 카탈로그 | **깨끗함** | 키 충돌 0건 |
| careet 후보 vs 카탈로그 | **깨끗함** | 키 충돌 0건 |
| discovery 병합 vs 카탈로그 | **깨끗함** | 461건 전부 `catalog_match_status: new` |
| 약어 사전 vs careet | **의도된 중복** | 23개 공유 키 (careet에서 import) |
| discovery 병합 내부 | **의도된 중복** | namu 435 + challenge 29 − 중복 3 = 461 |
| 카탈로그 내부 | **주의 필요** | alias 충돌 233키, 파일간 동일 타이틀 69키 |
| 소셜 후보 URL | **깨끗함** | `(meme_title, source_url)` 중복 0건 |

---

## 1. 파일 내 중복 (Within-file)

### 분류 기준

- **same_line**: 동일 레코드의 title/alias가 정규화 후 같은 키 → 대부분 정상 (의도된 alias)
- **cross_diff_pri**: 서로 다른 레코드·다른 primary가 같은 키 → **실질적 중복/충돌**

### 실질적 충돌이 있는 파일 (cross_diff_pri > 0)

| 파일 | dup_keys | extra | cross_diff_pri | 대표 예시 |
|------|----------|-------|----------------|-----------|
| `data/memes/verified/topup-new.jsonl` | 98 | 102 | **24** | `노잼`: L9 `노잼/핵노잼`(alias) ↔ L124 `노잼`(title) |
| `data/memes/verified/round2-587.jsonl` | 30 | 30 | **15** | `작업중이야`: L2 `작업 중이야` ↔ L168 `애니콜 작업중이야` |
| `data/memes/verified/round3-796.jsonl` | 13 | 14 | **6** | `골든xxx`: L193 `골든 XXX` ↔ L657 `골든 햄스터` |
| `data/memes/collected/careet-slang-candidates-2026-07-16.jsonl` | 2 | 2 | **2** | `깊은생각`: L6 `깊생` alias ↔ L7 `깊생은` alias |

#### topup-new.jsonl 추가 예시

- `얼죽코`: L19 `얼죽아`(alias) ↔ L596 `얼죽코`(title)
- `지린다`: L24 `지린다`(title) ↔ L171 `지렸다`(alias)
- `킹받네`: L178 `킹받다`(alias) ↔ L231 `킹받네`(title)

#### round2-587.jsonl 추가 예시

- `사딸라`: L11 `야인시대 사딸라·내가 고자라니` ↔ L154 `야인시대 사딸라`
- `의자춤`: L35 `신화 'Wild Eyes' 의자춤` ↔ L170 `손담비 미쳤어 계단춤`

#### careet 후보 충돌

- `카카오쇼핑라이브`: L10 `네이버 쇼핑라이브` alias ↔ L29 `쇼핑라이브` alias (서로 다른 term이 같은 alias 키 공유)

### same_line만 있는 파일 (title≡alias, 정상 패턴)

| 파일 | dup_keys | extra |
|------|----------|-------|
| `data/memes/raw/v-2020-21-c.jsonl` | 17 | 17 |
| `data/memes/raw/v-2014-16-b.jsonl` | 7 | 7 |
| `data/memes/raw/v-2005-09-c.jsonl` | 4 | 4 |
| `data/memes/raw/v-2010-13-c.jsonl` | 3 | 3 |
| `data/memes/raw/v-2017-19-a.jsonl` | 3 | 3 |
| `data/memes/raw/v-1990s-etc.jsonl` | 2 | 2 |
| `data/memes/raw/v-2005-09-b.jsonl` | 2 | 2 |
| `data/dictionary/abbreviations.jsonl` | 2 | 2 |
| 기타 raw 7파일 | 각 1 | 각 1 |

`abbreviations.jsonl` same_line: `이타백`/`이타 백`, `핫도그보이`/`핫도그 보이` — 띄어쓰기 변형 alias, 정상.

### discovery 수집 파일 (within-file)

| 파일 | 레코드 수 | dup_keys |
|------|-----------|----------|
| `new-meme-discovery-2010-2026-merged-2026-07-16.jsonl` | 461 | 0 |
| `challenge-trend-new-memes-2010-2026-2026-07-16.jsonl` | 29 | 0 |
| `namu-period-new-memes-2010-2026-2026-07-16.jsonl` | 435 | 0 |

---

## 2. 파일 간 카탈로그 충돌 (Cross-file catalog)

**카탈로그 규모**: verified 3파일 + raw 23파일 = 26파일, 2,693레코드, 5,841고유 키

### discovery / dictionary / careet → 카탈로그

| 소스 | 카탈로그 키 충돌 |
|------|------------------|
| `new-meme-discovery-merged` | **0** |
| `challenge-trend-new-memes` | **0** |
| `namu-period-new-memes` | **0** |
| `careet-slang-candidates` | **0** |
| `abbreviations.jsonl` | **0** |

### discovery 병합 구조

- `merged` = `namu`(435) ∪ `challenge`(29), 교집합 3건
- `merged`-only 26건 = challenge 전용 (namu에 없는 챌린지 밈)
- challenge∩namu 3건: `아디아디 챌린지`, `띵띵땅땅 챌린지`, `홍박사 챌린지` (양쪽 소스에 존재)

### 카탈로그 내부 alias 충돌 (서로 다른 primary가 같은 키) — 233키

대표 20건:

| 키 | 충돌 primary (일부) |
|----|---------------------|
| `대한민국짝짝짝짝짝` | 대~한민국 짝짝짝 짝짝 / 대~한민국 짝짝짝짝짝 / 대한민국 짝짝짝짝짝 |
| `god어머님께` | god - 어머님께 / god 어머님께 / 어머님께 |
| `사딸라` | 사딸라 / 야인시대 사딸라 / 야인시대 사딸라·내가 고자라니 |
| `이경규몰래카메라` | 이경규 몰래카메라 / 몰래카메라 |
| `몰래카메라` | 몰래카메라 / 이경규 몰래카메라 |
| `룰라34` | 3!4! / 룰라 3!4! |
| `맨발의투혼` | 맨발의 투혼 / 박세리 맨발 투혼 / 박세리 맨발의 투혼 |
| `임요환테란의황제` | 임요환 "테란의 황제" / 임요환 '테란의 황제' / 임요환 테란의 황제 |
| `묻고더블로가` | 곽철용 묻고 더블로 가 / 곽철용(타짜) / 타짜 묻고 더블로 가 |
| `불닭볶음면챌린지` | 불닭볶음면 챌린지 / 파이어 누들 챌린지 / 핵불닭볶음면 챌린지 |
| `babyshark` | 아기상어 (핑크퐁) / 아기상어(베이비샤크) / 핑크퐁 아기상어 |
| `두바이쫀득쿠키` | 두쫀쿠 / 두쫀쿠 신드롬 / 마시멜로 쫀득쿠키 |
| `가나디` | 가나디(듀아아아) / 듀아아아 (가나디) / 듀아아아 밈 |
| `최애` | 본진 / 최애 / 최애캐 |
| `1도없다` | 1도 모르겠습니다 / 1도 없다 / 1도 없다 / 1도 모르겠다 |

### 카탈로그 파일 간 동일 타이틀 키 — 69키

동일 정규화 키가 verified·raw 여러 파일에 별도 레코드로 존재. 예:

- `대한민국짝짝짝짝짝` → round2-587, v-2000-04-a, v-2000-04-c
- `임요환테란의황제` → round2-587, v-2000-04-a
- `졸라맨` → v-2000-04-a/b/c
- `차도남차도녀` → round2-587, topup-new

### abbreviations ↔ careet — 23 공유 키 (import 의도)

| 키 | abbrev term | careet term |
|----|-------------|-------------|
| `깊생` | 깊생 | 깊생 |
| `깊은생각` | 깊생 (alias) | 깊생, **깊생은** (alias 충돌) |
| `메트로타이핑앱` | 메트로 타이핑 (alias) | 메트로 타이핑 앱 |
| `좋반해요` | 좋반 (alias `#좋반해요`) | 좋반 |
| `오늘의노래추천` | 오노추 (alias) | 오노추 |

---

## 3. abbreviations.jsonl 근접 중복 (Near-duplicates)

정규화 키가 포함 관계이거나 3자 이내 차이:

| 키 A | 키 B | 비고 |
|------|------|------|
| `메트로타이핑` | `메트로타이핑앱` | term vs alias, 동일 레코드 |
| `좋반` | `좋반해요` | `#` 기호 제거 후 alias 충돌 |

**깊생 vs 깊생은**: abbreviations에는 없음. careet 후보 L6/L7에서 alias `깊은 생각`이 공유됨.

---

## 4. 소셜 후보 URL 중복

검사 파일 (2026-07-16):

| 파일 | 행 수 | 중복 (title, url) 쌍 |
|------|-------|----------------------|
| `social-discovery-candidates-2010-2026-2026-07-16.jsonl` | 61 | 0 |
| `youtube-shorts-new-meme-candidates-2010-2026-2026-07-16.jsonl` | 155 | 0 |
| `youtube-shorts-oembed-verified-2010-2026-2026-07-16.jsonl` | 25 | 0 |
| `youtube-shorts-source-candidates-2010-2026-2026-07-16.jsonl` | 64 | 0 |
| `youtube-shorts-source-candidates-2010-2026-merged-2026-07-16.jsonl` | 344 | 0 |
| `youtube-shorts-source-candidates-2013-2018-2026-07-16.jsonl` | 120 | 0 |
| `youtube-shorts-source-candidates-2019-2026-07-16.jsonl` | 160 | 0 |

**총 추가 중복 행: 0**

---

## 5. 종합 판정

### 약어 사전 (abbreviations.jsonl)

- 카탈로그와 **충돌 없음** → import 전 검토 관점에서 깨끗함
- careet 후보와 23키 공유는 import 출처상 정상
- 파일 내 2건은 띄어쓰기 alias 변형 (이타백, 핫도그보이)

### discovery 병합

- 카탈로그와 **충돌 없음** → 461건 신규 후보로 일관됨
- merged = namu + challenge 병합 구조 정상 (435 + 26 unique challenge = 461)
- 파일 내 exact key 중복 없음

### 카탈로그 (verified + raw) — 기존 데이터 품질 이슈

- alias 키 충돌 233건: 서로 다른 밈이 짧은 alias를 공유 (예: `몰래카메라`, `3!4!`, `최애`)
- 파일 간 동일 타이틀 69건: round2와 raw 시대별 파일 간 중복 레코드
- verified 3파일 내 실질 충돌 45건 (topup 24 + round2 15 + round3 6)

### 권장 후속 조치 (보고만, 미수정)

1. `topup-new.jsonl` / `round2-587.jsonl` alias-타이틀 충돌 레코드 병합 검토
2. careet `깊생`/`깊생은` alias 정리
3. 카탈로그 alias 충돌 상위 키에 대한 canonical 매핑 정책 수립

---

## 6. 중복 심각 파일 (절대 경로)

| 순위 | 경로 | 이유 |
|------|------|------|
| 1 | `/Users/toris/projects/memecatch/data/memes/verified/topup-new.jsonl` | cross_diff_pri 24, dup_keys 98 |
| 2 | `/Users/toris/projects/memecatch/data/memes/verified/round2-587.jsonl` | cross_diff_pri 15, 파일간 중복 다수 |
| 3 | `/Users/toris/projects/memecatch/data/memes/verified/round3-796.jsonl` | cross_diff_pri 6 |
| 4 | `/Users/toris/projects/memecatch/data/memes/raw/v-2020-21-c.jsonl` | dup_keys 17 (same_line) |
| 5 | `/Users/toris/projects/memecatch/data/memes/collected/careet-slang-candidates-2026-07-16.jsonl` | alias 충돌 2 (깊생/깊생은) |

---

*생성: 2026-07-16 | 도구: Python + regex (meme-title-key 동등 정규화)*
