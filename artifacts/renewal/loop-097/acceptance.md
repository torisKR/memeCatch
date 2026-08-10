# Loop 097 acceptance

## 목표

글로벌 사용자가 자기 언어의 검색 URL에서 밈을 찾고, 검수된 번역이 있는 결과는 해당 locale 상세로,
없는 결과는 언어를 속이지 않는 한국어 원문으로 안전하게 이동하도록 검색 발견성 surface를 닫는다.

## 완료 조건

- `/en|ja|zh|zh-tw/search`와 `?q=`가 200으로 렌더되고 문서 언어·검색 카피·헤더 form/mobile 링크가
  locale 경로를 사용한다.
- 검색 후보와 순서는 기존 한국어 `search_memes` RPC 결과를 유지한다. 인기 칩도 같은 한국어 검색
  계약으로 실제 재검색 가능한 원문을 사용한다.
- `reviewed + current source revision + 필수 필드 + 원문 content depth`를 모두 통과한 exact locale
  번역만 locale 상세 URL과 번역 제목·요약을 사용한다.
- machine/stale/incomplete/depth 부족 또는 조회 실패 결과는 한국어 상세 URL로 폴백하고,
  locale별 원문 라벨과 `lang="ko"`를 렌더한다.
- 검색 route metadata는 `noindex, follow`와 locale self-canonical만 제공하고, query variant를
  canonical·sitemap·hreflang으로 만들지 않는다.
- 언어 전환 시 `/search?q=...`의 query를 보존한다. `zh-tw`는 번체 카피를 직접 제공한다.

## 범위 밖

번역 생성·OpenAI 호출·machine→reviewed 승인·production Supabase write·sitemap 공개·자동 게시·
production deploy·push/merge는 수행하지 않는다.
