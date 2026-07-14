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

공개 검색은 서비스에 부담을 주지 않도록 요청 사이에 0.7초의 간격을 둔다.
`--years`와 `--max-per-year`를 사용하면 2000~2020년 각 연도를 고르게
표본화할 수 있다.

YouTube Shorts도 동일하게 공개 검색 후보만 별도로 수집합니다. `shortsLockupViewModel`의
`reelWatchEndpoint`가 있는 결과만 `https://www.youtube.com/shorts/{videoId}` 최종 URL로 기록합니다.
초기 `batch-01`~`05`와 연도별 4개 제목을 고르게 조회한 `balanced-01`~`09`를
중복 제거하면 74개 밈 제목의 후보 748건이 남는다. 모두
`needs_human_source_match` 상태다.

```sh
node scripts/collect-youtube-candidates.mjs \
  data/memes/verified \
  data/memes/collected/youtube-shorts-source-candidates-YYYY-MM-DD.jsonl \
  --format=shorts --max=100 --per-query=10
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
  --max=20 --per-query=3
```

`instagram-oembed-candidates-2026-07-14-batch-01.jsonl`은 공개 검색 인덱스에서
발견하고 oEmbed 응답을 확인한 후보 3건이다. 모두 원본성 검수 전이며 자동 공개하지 않는다.

TikTok은 공개 웹에 이미 색인된 최종 `tiktok.com/@.../video/...` URL만 시드로 받는다.
수집기는 TikTok 페이지를 크롤링하거나 로그인하지 않고 oEmbed로 공개 임베드 가능 여부만
검증한다. `tiktok-public-index-seeds-2026-07-14.jsonl`의 시드 7건은
`tiktok-oembed-candidates-2026-07-14-batch-01.jsonl`로 검증해 사용한다.

```sh
node scripts/collect-tiktok-oembed-candidates.mjs \
  data/memes/collected/tiktok-public-index-seeds-2026-07-14.jsonl \
  data/memes/collected/tiktok-oembed-candidates-YYYY-MM-DD.jsonl
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

2026-07-14 실행에서는 공식 문서가 인용한 원본 10개를 발견했고, 현재도 공개 oEmbed가
성공한 8개를 후보로 저장했다. 삭제·비공개 등으로 oEmbed가 실패한 2개는 오류 파일에만
기록하고 후보에서 제외했다.

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
