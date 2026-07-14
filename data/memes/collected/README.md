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
