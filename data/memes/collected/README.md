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
`youtube-shorts-source-candidates-2026-07-14-batch-01`~`05`에는 대표 가능한 15개
연도에서 수집한 후보 169건이 들어 있으며, 모두 `needs_human_source_match` 상태다.

```sh
node scripts/collect-youtube-candidates.mjs \
  data/memes/verified \
  data/memes/collected/youtube-shorts-source-candidates-YYYY-MM-DD.jsonl \
  --format=shorts --max=100 --per-query=10
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
