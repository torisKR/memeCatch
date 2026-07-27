# 수집 출처 후보

`youtube-source-candidates-2026-07-14.jsonl`은 2000~2020년 기존 밈을
대상으로 공개 YouTube 검색에서 수집한 **검수 전용** 출처 후보 1,963건이다.

각 행은 `meme_title`, `origin_year`, `source_url`, 검색 결과의 제목·채널·업로드
표시, 검색어와 수집 시각을 포함한다. 모든 행의 `review_status`는
`needs_human_source_match`다.

이 파일은 시드 데이터가 아니다. 검색 결과가 밈의 원본 또는 권리자 공식 업로드임을
보장하지 않으므로, 다음을 모두 확인한 뒤에만 `meme_sources` 또는
`meme_contents`에 반영한다.

1. 영상이 해당 밈의 실제 원본이거나 권리자가 공개한 공식 업로드인지 확인한다.
2. 영상 제목·게시 채널·장면이 밈 제목과 일치하는지 확인한다.
3. 재게시물, 편집 모음, 비공개·삭제 위험 링크는 제외한다.

수집 재현 명령:

```sh
node scripts/collect-youtube-candidates.mjs \
  data/memes/verified \
  data/memes/collected/youtube-source-candidates-2026-07-14.jsonl \
  --years=2000,2001,2002 --max-per-year=4 --max=12 --per-query=20
```

공개 검색은 서비스에 부담을 주지 않도록 요청 사이에 기본 0.7초( `--delay=` 로 조절)의
간격을 둔다. `--years`와 `--max-per-year`를 사용하면 2010~2026년 각 연도를 고르게
표본화할 수 있다. 연도 허용 범위는 2000~2026이다.

YouTube Shorts도 동일하게 공개 검색 후보만 별도로 수집합니다. `shortsLockupViewModel`의
`reelWatchEndpoint`가 있는 결과만 `https://www.youtube.com/shorts/{videoId}` 최종 URL로 기록합니다.
초기 `batch-01`~`05`와 연도별 4개 제목을 고르게 조회한 `balanced-01`~`09`를
중복 제거하면 74개 밈 제목의 후보 748건이 남는다. 모두
`needs_human_source_match` 상태다.

2026-07-16에는 검증 카탈로그의 2010~2026년 한국 밈을 연도별 표본으로 조회해
`youtube-shorts-source-candidates-2010-2026-merged-2026-07-16.jsonl`에 Shorts 후보
344건(43개 제목, 17개 연도)을 추가했다. 우선순위 high 25건은 oEmbed로 제목·작성자를
보강했다.

```sh
node scripts/collect-youtube-candidates.mjs \
  data/memes/verified \
  data/memes/collected/youtube-shorts-source-candidates-YYYY-MM-DD.jsonl \
  --format=shorts --years=2010,2011,2012 --max-per-year=4 --max=68 --per-query=8 --delay=2500
```

검수 우선순위가 높은 Shorts 후보는 API 키 없이 공개 YouTube oEmbed의 제목·작성자만
보강할 수 있다. 이 단계도 임베드 가능 여부만 확인하며 원본성이나 게시 권한을 승인하지 않는다.

```sh
node scripts/enrich-youtube-oembed-candidates.mjs \
  data/memes/review/social-source-ranking-YYYY-MM-DD.jsonl \
  data/memes/collected/youtube-shorts-oembed-verified-YYYY-MM-DD.jsonl \
  --priority=high --max=50
```

TikTok과 Instagram은 로그인·권한 또는 실제 공개 게시물의 최종 URL 없이 신뢰할 수
있는 원본성을 판별할 수 없다. 따라서 두 플랫폼은 TikTok `video.list` 동의 가져오기나
제보 양식으로 받은 `tiktok.com/@.../video/...`, `instagram.com/reel|p|tv/...` URL만
검수 후보로 수집한다. 검색 스니펫이나 단축 URL은 데이터에 넣지 않는다.

Instagram은 공개 DuckDuckGo 인덱스에서 발견한 최종 릴스 URL을 Instagram oEmbed로
한 번 더 확인할 수 있다. Instagram 페이지를 직접 크롤링하거나 로그인·차단 우회를 하지
않으며, oEmbed HTML·메타데이터는 저장하지 않는다. 검색 서비스가 챌린지를 요구하면
수집기는 재시도·우회를 하지 않고 즉시 중단한다.

```sh
node scripts/collect-instagram-oembed-candidates.mjs \
  data/memes/verified \
  data/memes/collected/instagram-oembed-candidates-YYYY-MM-DD.jsonl \
  --max=20 --per-query=3 --years=2010,2011 --max-per-year=2
```

`instagram-oembed-candidates-2026-07-14-batch-01.jsonl`은 공개 검색 인덱스에서
발견하고 oEmbed 응답을 확인한 후보 3건이다. 모두 원본성 검수 전이며 자동 공개하지 않는다.

2026-07-16에는 DuckDuckGo 챌린지 전에 2010~2011년 릴스 후보 6건을 확보했고,
공개 웹 검색(Firecrawl)으로 발견한 최종 Instagram/TikTok URL은
`social-discovery-candidates-2010-2026-2026-07-16.jsonl`로 oEmbed 검증했다
(61건, 그중 제목 매칭 24건).

TikTok은 공개 웹에 이미 색인된 최종 `tiktok.com/@.../video/...` URL만 시드로 받는다.
수집기는 TikTok 페이지를 크롤링하거나 로그인하지 않고 oEmbed로 공개 임베드 가능 여부만
검증한다. `tiktok-public-index-seeds-2026-07-14.jsonl`의 시드 7건은
`tiktok-oembed-candidates-2026-07-14-batch-01.jsonl`로 검증해 사용한다.

```sh
node scripts/collect-tiktok-oembed-candidates.mjs \
  data/memes/collected/tiktok-public-index-seeds-2026-07-14.jsonl \
  data/memes/collected/tiktok-oembed-candidates-YYYY-MM-DD.jsonl
```

Instagram과 같이 DuckDuckGo 공개 검색으로 최종 TikTok URL을 찾을 수도 있다.
챌린지가 나오면 재시도·우회 없이 중단한다.

```sh
node scripts/collect-tiktok-public-search-candidates.mjs \
  data/memes/verified \
  data/memes/collected/tiktok-public-search-candidates-YYYY-MM-DD.jsonl \
  --years=2018,2019,2020 --max-per-year=2 --max=18 --per-query=3
```

공개 검색 스니펫·Firecrawl 결과 파일에 이미 포함된 최종 소셜 URL은 oEmbed만으로
후보화할 수 있다.

```sh
node scripts/build-social-candidates-from-discovery.mjs \
  data/memes/collected/.work \
  data/memes/verified \
  data/memes/collected/social-discovery-candidates-YYYY-MM-DD.jsonl
```

TikTok 앱 심사 없이도 공식 TikTok Newsroom의 연도별 인기 콘텐츠 문서에서 문서가
직접 인용한 최종 `tiktok.com/@.../video/...` URL을 찾을 수 있다. 이 수집기는
`newsroom.tiktok.com` HTTPS 문서만 허용하고, 각 URL을 공개 oEmbed로 다시 확인한다.
앱 키·로그인·쿠키·TikTok 검색·프로필 크롤링·단축 URL·차단 우회·영상 다운로드는
사용하지 않는다. Newsroom 선정은 발견 근거일 뿐 CatchMeme 제목 매핑이나 권리 승인이
아니므로 모든 결과는 `catalog_match_status = unmapped` 및
`needs_human_source_match`로 저장한다.

```sh
node scripts/collect-tiktok-newsroom-candidates.mjs \
  'https://newsroom.tiktok.com/2019-tiktok-top-100?lang=ko-KR' \
  data/memes/collected/tiktok-newsroom-candidates-2019-YYYY-MM-DD.jsonl
```

### 추가 경로 A — 공개 기사·위키 인용 (Instagram + TikTok)

Newsroom 전용이 아닌 **공개 HTTPS 기사/위키/미디어 페이지**가 이미 최종 게시물
URL을 인용한 경우, 그 페이지 HTML에서 Instagram(`/reel|p|tv/`)·TikTok(`/video/`)
URL을 추출하고 oEmbed로 검증한다. 플랫폼 게시물 페이지 자체는 입력으로 받지 않으며
(시드 경로 사용), 로그인·챌린지 응답이 오면 재시도 없이 중단한다.

```sh
# 한 기사 URL, 또는 기사 URL 목록(.txt / .jsonl)
node scripts/collect-public-article-social-candidates.mjs \
  data/memes/collected/.work/public-article-urls-YYYY-MM-DD.txt \
  data/memes/collected/public-article-social-candidates-YYYY-MM-DD.jsonl \
  --max-per-article=50 --verified=data/memes/verified
```

2026-07-16 실행: 나무위키 시기별 문서 등 16개 공개 페이지 → oEmbed 통과 **52건**
(TikTok 44 · Instagram 8, 카탈로그 제목 매칭 52). 파일
`public-article-social-candidates-2026-07-16.jsonl`.

### 추가 경로 B — 공개 인덱스 시드 oEmbed (Instagram + TikTok 공용)

Firecrawl·기사 스니펫 등에서 이미 확보한 최종 게시물 URL 시드를 한 파일에 모아
플랫폼 공용 oEmbed로 검증한다. TikTok 전용 시드 수집기
(`collect-tiktok-oembed-candidates.mjs`)와 동일 원칙이며 Instagram 시드도 함께 처리한다.

```sh
node scripts/collect-social-oembed-seeds.mjs \
  data/memes/collected/.work/social-index-seeds-YYYY-MM-DD.jsonl \
  data/memes/collected/social-index-oembed-candidates-YYYY-MM-DD.jsonl
```

2026-07-16 실행: 시드 65건 → oEmbed 통과 **62건**(TikTok 46 · Instagram 16, 실패 3).
파일 `social-index-oembed-candidates-2026-07-16.jsonl`.

Instagram 공개 검색 수집기는 릴스뿐 아니라 `/p/` 게시물 쿼리도 함께 조회한다
(`site:instagram.com/reel` + `site:instagram.com/p`).

### 추가 경로 C — 2차 공개 문서 (나무 개별·KYM·미디어)

DDG 검색·Newsroom·Firecrawl 인덱스 시드와 **겹치지 않는** 경로다. 나무위키
**개별 밈/챌린지 문서**, Know Your Meme 문서, 선별 미디어·위키 페이지에서
최종 IG/TikTok URL을 추출하고 oEmbed로 검증한다. 프로덕션 `meme_contents` URL과
기존 collected 후보를 `--exclude` / `--exclude-urls`로 건너뛴다.

```sh
# 1) 프로덕션 URL 목록 갱신 후
node scripts/collect-secondary-social-candidates.mjs \
  data/memes/collected/.work/secondary-article-urls-YYYY-MM-DD.txt \
  data/memes/collected/secondary-social-candidates-YYYY-MM-DD.jsonl \
  --exclude=data/memes/collected \
  --exclude-urls=data/memes/collected/.work/prod-social-urls.txt \
  --verified=data/memes/verified \
  --max-pages=70 --max-per-page=15
```

2026-07-16 실행: 71 페이지 → 신규 oEmbed 후보 **113건**(TikTok 93 · Instagram 20,
중복 스킵 1, 카탈로그 매칭 20). 파일
`secondary-social-candidates-2026-07-16.jsonl` (경로: KYM 54 · namu 59).

### 추가 경로 D — 3차 (Bing·Reddit·작업덤프·Firecrawl 스크래프)

DDG·Newsroom·2차 기사 인용과 겹치지 않는 경로:

```sh
# Bing HTML + Reddit public JSON + residual work URLs
node scripts/collect-tertiary-social-candidates.mjs \
  data/memes/verified \
  data/memes/collected/tertiary-social-candidates-YYYY-MM-DD.jsonl \
  --years=2022,2023,2024,2025,2026 --max=36 \
  --exclude=data/memes/collected \
  --exclude-urls=data/memes/collected/.work/prod-social-urls.txt \
  --work=data/memes/collected/.work

# 새 KYM/나무 문서 배치 (secondary 수집기 재사용, exclude로 중복 제거)
node scripts/collect-secondary-social-candidates.mjs \
  data/memes/collected/.work/tertiary-article-urls-YYYY-MM-DD.txt \
  data/memes/collected/tertiary-article-social-YYYY-MM-DD.jsonl \
  --exclude=data/memes/collected \
  --exclude-urls=data/memes/collected/.work/prod-social-urls.txt \
  --verified=data/memes/verified
```

2026-07-16: tertiary workdir Instagram 14 + KYM 신규 기사 TikTok/IG 29 +
Firecrawl KYM 스크래프 oEmbed 31. 프로덕션 미포함·제목 강매칭 통과분만
`meme_contents`/`meme_sources`에 직접 반영.

### 추가 경로 E — 4차 (Firecrawl 스크래프 + 해시태그 규칙 매핑)

Google/Bing SERP는 챌린지로 막혀 있어, Firecrawl로 KYM 챌린지·검색 덤프를
스크래프한 뒤 최종 URL을 oEmbed 검증하고 해시태그→카탈로그 규칙으로 매핑한다.

```sh
# work 디렉터리에 firecrawl scrape 결과(.md/.json)를 모은 뒤
node scripts/collect-quaternary-social-candidates.mjs \
  data/memes/collected/.work/quaternary-fc \
  data/memes/collected/quaternary-oembed-YYYY-MM-DD.jsonl \
  --exclude-urls=data/memes/collected/.work/prod-social-urls.txt
```

2026-07-16 예: RAIN `#깡챌린지` → **1일1깡 챌린지** 프로덕션 반영.

### 추가 경로 F — 5차 (엔터테인먼트 미디어 검색 + Wikipedia MediaWiki)

DDG/Bing/Newsroom/namu-KYM 기사/Firecrawl 인덱스·KYM 스크래프와 **겹치지 않는** 경로다.
Firecrawl **웹 검색**으로 Billboard·Soompi·Allkpop·Koreaboo·Rolling Stone 등 공개 기사 URL을
모은 뒤 직접 HTML 페치, 그리고 en/ko Wikipedia MediaWiki `extlinks`/wikitext에서
최종 IG/TikTok URL을 추출·oEmbed 검증한다.

```sh
node scripts/collect-quinary-social-candidates.mjs \
  data/memes/collected/.work/quinary-fc \
  data/memes/collected/quinary-oembed-YYYY-MM-DD.jsonl \
  --exclude-urls=data/memes/collected/.work/prod-social-urls.txt \
  --exclude=data/memes/collected \
  --verified=data/memes/verified \
  --max-articles=36 --max-searches=8 --wiki=1
```

2026-07-16: oEmbed 후보 64건 중 해시태그 강매칭 2건 프로덕션 반영  
(STAYC `#PoppyChallenge` → **스테이씨 파피 챌린지**, ZICO `#AnysongChallenge` → **아무노래 챌린지**).

### 추가 경로 G — 6차 (미보유 챌린지 타깃 검색)

카탈로그에 TikTok/IG가 없는 챌린지를 제목별로 Firecrawl 검색한 뒤 oEmbed 검증하고,
**전체 제목 포함 또는 고신뢰 해시태그**만 승격한다.

2026-07-16 프로덕션 7건: GGEZ, 마네킹, 딩가딩가(마마무 공식), 병뚜껑, 삐끼삐끼,
아이스버킷, 원칩. 기록 `data/memes/review/social-senary-paths-2026-07-16.md`.

### 추가 경로 H — 7차 (미보유 히트 챌린지 타깃)

BTS Dynamite, NewJeans 시리즈, IVE, aespa, RIIZE, BABYMONSTER 등 **아직 TT/IG가 없는**
인기 챌린지 30쿼리 → oEmbed 60건 → 강매칭 26건 프로덕션 반영.
기록 `data/memes/review/social-septenary-paths-2026-07-16.md`.

### 추가 경로 I — 8차 (잔여 히트 챌린지)

Permission to Dance, Mantra, POWER, aespa Whiplash/Spicy/Drama, RIIZE, TWS, SKZ,
SEVENTEEN 등 41쿼리 → oEmbed 81건 → 강매칭 **36건** 반영.
기록 `data/memes/review/social-octonary-paths-2026-07-16.md`.

### 추가 경로 J — 9차

JISOO Flower/Earthquake, EASY, 밤양갱, CHOOM, REBEL HEART, WORK, Polaroid Love 등
48쿼리 → oEmbed 109건 → 강매칭 **41건** 반영.
기록 `data/memes/review/social-nonary-paths-2026-07-16.md`.

### 추가 경로 K — 10차 (갭 검사 후 보충)

미보유 131건 검사: 기존 collected 후보 중 전체 제목 매칭 0건(소진).
Firecrawl 40쿼리 → oEmbed 53 → 강매칭 **18건** (Dynamite, ONE SPARK, Poppy 중복 타이틀,
CORTIS GO, H2H RUDE, 햄부기 등). 기록 `data/memes/review/social-decenary-paths-2026-07-16.md`.

### 추가 경로 L — 11차 (2026-07-17)

미보유 ~113건 대상 43쿼리 → oEmbed 75 → 강매칭 **20건** (Hype Boy, Love Dive,
After LIKE, Seven, MONEY, 클락션, 스니커즈, 움파룸파, APT, 티라미수 등).
기록 `data/memes/review/social-undecary-paths-2026-07-17.md`.

### Instagram 추가 (2026-07-17)

`site:instagram.com/reel|p` Firecrawl 검색 + 기사 수확 → oEmbed 124 → 강매칭
**10건** Instagram 프로덕션 반영 (하입보이 NewJeans, 밤양갱 비비, 아무노래, LALISA,
병뚜껑, 아이스버킷, 마네킹, 원칩, 웬즈데이, 달고나 등).
기록 `data/memes/review/social-instagram-extra-2026-07-17.md`.

2026-07-14 실행에서는 공식 문서가 인용한 원본 10개를 발견했고, 현재도 공개 oEmbed가
성공한 8개를 후보로 저장했다. 삭제·비공개 등으로 oEmbed가 실패한 2개는 오류 파일에만
기록하고 후보에서 제외했다.

2026-07-16에는 Year on TikTok 2023·2024 Newsroom 문서에서 oEmbed 검증 후보
67건(2023: 49, 2024: 18)을 추가했다. 한국어 음악 결산 페이지에는 인용 영상 URL이
없어 0건이었다.

기존 카탈로그에 없는 **신규 밈·챌린지**는 나무위키 시기별 문서와 공개 챌린지
스니펫에서 별도로 발견한다. `memeTitleKey`로 verified/raw 제목·별칭과 중복을
제거한 뒤에만 저장한다.

```sh
firecrawl scrape "https://namu.wiki/w/밈(인터넷 용어)/시기별" \
  -o data/memes/collected/.work/namu-period-memes.md

node scripts/collect-namu-period-meme-candidates.mjs \
  data/memes/collected/.work/namu-period-memes.md \
  data/memes/verified,data/memes/raw \
  data/memes/collected/namu-period-new-memes-2010-2026.jsonl \
  --years=2010-2026

node scripts/collect-challenge-trend-candidates.mjs \
  data/memes/collected/.work \
  data/memes/verified,data/memes/raw \
  data/memes/collected/challenge-trend-new-memes.jsonl \
  --years=2010-2026
```

2026-07-16 병합본 `new-meme-discovery-2010-2026-merged-2026-07-16.jsonl`에는
카탈로그에 없던 신규 후보 약 460건(챌린지 29건 포함)이 있다. 이 중 시드 33개
제목에 대해 Shorts 출처 후보 155건을
`youtube-shorts-new-meme-candidates-2010-2026-2026-07-16.jsonl`에 모았다.

careet.net(요즘어 사전·밈 기사·MicroTrend 공개분)에서 수집한 줄임말/신조어 후보는
`careet-slang-candidates-2026-07-16.jsonl`에 두고, 검수 가능한 항목만
`data/dictionary/abbreviations.jsonl` 줄임말 사전으로 승격한다. Dictionary 본문은
멤버십 페이월이라 무료 공개 구간만 사용한다.

```sh
node scripts/collect-careet-slang-candidates.mjs \
  data/memes/collected/.work,.firecrawl \
  data/memes/verified,data/memes/raw \
  data/memes/collected/careet-slang-candidates-2026-07-16.jsonl

node scripts/import-careet-to-abbreviation-dictionary.mjs \
  data/memes/collected/careet-slang-candidates-2026-07-16.jsonl \
  data/dictionary/abbreviations.jsonl
```

앱 API 심사와 별개로, 이미 확보한 TikTok·Instagram 최종 공개 URL은 게시물 페이지 또는
Instagram의 공개 `embed/captioned` 페이지가 로그인 없이 제공하는 메타데이터로 한 번 더 보강할 수 있다. 이 경로는
앱 키·로그인·쿠키·비공개 엔드포인트·차단 우회를 사용하지 않으며, 제목·설명·작성자와 썸네일
제공 여부만 최대 1MB의 HTML 안에서 추출한다. 만료되는 CDN 썸네일 URL 자체는 저장하지 않는다. 로그인이나 사람 확인 화면이 반환되면 재시도하지
않고 오류 파일에 기록한다. 결과는 계속 `needs_human_source_match` 상태이며 자동 공개하지 않는다.

2026-07-14 검증에서는 Instagram 공개 임베드 페이지 3건이 메타데이터를 반환했다.
TikTok 일반 게시물 페이지는 7건 모두 로그인/챌린지 응답이어서 우회하지 않았고, 이미
검증된 공개 oEmbed 후보의 제목·작성자 정보만 유지한다.

```sh
node scripts/collect-public-social-page-metadata.mjs \
  data/memes/collected/tiktok-oembed-candidates-YYYY-MM-DD.jsonl \
  data/memes/collected/tiktok-public-page-candidates-YYYY-MM-DD.jsonl
```

Wikimedia의 공개 연도별 분류는 글로벌 밈 제목 후보를 찾는 데만 사용한다. 이 결과는
한국어 기존 제목과 중복될 수 있고 원본 콘텐츠 URL도 아니므로, 운영 시드나 공개 데이터로
직접 사용하지 않는다.

```sh
node scripts/collect-wikimedia-meme-candidates.mjs \
  data/memes/collected/wikimedia-meme-candidates-YYYY-MM-DD.jsonl \
  --years=2000,2001,2002
```

연도별 분류에 빠진 공개 바이럴 영상은 별도 명시 시드로만 보강한다. 수집기는 각
Wikipedia 페이지의 존재를 확인하지만, 원본 업로드나 발생 연도를 확정하지 않는다.

```sh
node scripts/collect-wikimedia-viral-video-candidates.mjs \
  data/memes/collected/wikimedia-viral-video-candidates-YYYY-MM-DD.jsonl
```

## 2026-07-27 — 나무위키 시기별 2025~2026 신규 밈 수집·드래프트 적재

`namu-period-new-memes-2025-2026-2026-07-27.jsonl`은 2026-07-27에 새로 스크랩한
나무위키 "밈(인터넷 용어)/시기별" 문서(`.firecrawl/namu-sigi-2026-07-27.md`)에서
2025~2026년 구간만 추출한 신규 후보 116건이다(2025년 73, 2026년 43). 프로덕션
카탈로그(`data/memes/prod-catalog/prod-2026-07-27.jsonl`, 4,513개 제목·별칭)와
중복 제거했다.

```sh
node scripts/collect-namu-period-meme-candidates.mjs \
  .firecrawl/namu-sigi-2026-07-27.md \
  data/memes/prod-catalog \
  data/memes/collected/namu-period-new-memes-2025-2026-2026-07-27.jsonl \
  --years=2025-2026
```

이 중 내용 검증이 가능한 26건은 요약·설명·유래 드래프트를 작성해
`namu-2025-2026-drafts-2026-07-27.jsonl`에 정리하고, 프로덕션에
`moderation_status='pending'`(검수 대기)으로 적재했다(나무위키 출처 링크
`Community` 플랫폼으로 첨부). 공개 전에 `/admin/memes?status=pending`에서
사실 확인·저작권 확인 검수가 필요하다. 나머지 90건은 근거 확인이 부족해
적재하지 않고 후보 파일에 남긴다.

같은 날 맥락 주의(yellow) 밈 24개의 SNS 출처 보강 작업도 진행했다. YouTube Data
API로 밈당 후보를 수집해 `meme_media` 검수 큐에 적재(115건)하고, 프로젝트 표준
자동 승인 규칙(제목·채널명 정확 일치)과 수동 제목 검토로 23개 밈에 SNS 임베드를
게시했다. 동명 이종 콘텐츠(노래·크리에이터·소설) 오탐 14건은 게시 취소하고 원장을
rejected로 정리했다. SNS 출처를 끝내 찾지 못한 `핫바리`는
`moderation_status='fact_checking'`으로 비공개 전환해
`/admin/memes?status=fact_checking`에서 검수한다(이 전이는
`20260727000000_unpublish_to_fact_checking.sql` 마이그레이션으로 추가된
approved/limited → fact_checking 경로를 사용한다).
