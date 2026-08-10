# Loop 069 acceptance

## User outcome

한국어 canonical 밈 상세에서 아직 공개 가능한 reviewed/current 번역이 없는 글로벌 언어를 알 수
있고, 활성 Plus가 자기 저장 밈의 번역 우선 검수를 요청할 수 있다. AI 탐색 피드는 검수되지 않은
machine/stale draft를 공개 콘텐츠로 오인하지 않는다.

## Acceptance contract

- 상세는 `en`·`ja`·`zh`·`zh-tw` 중 현재 reviewed/current 행이 없는 locale만 요청 영역에 보여준다.
- 요청 CTA는 기존 `TranslationPriorityButton`과 `/api/translation-priority`를 사용하며, Plus·저장 밈·owner scope·공개 상태 검증을 새로 우회하지 않는다.
- 요청 영역은 locale availability를 설명하지만 번역 텍스트를 생성하거나 자동 승인·게시하지 않는다.
- 네 개 SEO locale의 `llms.txt`는 machine/outdated draft가 operator-private이며 공개 페이지·검색·AI discovery feed에서 제외된다고 설명한다.
- sitemap·hreflang·canonical 공개 범위와 production 데이터는 변경하지 않는다.

## Safety boundary

- 기존 서버 entitlement/RLS/RPC/CAS 경계를 재사용하고 직접 translation insert나 publish를 열지 않는다.
- 공개 getter가 반환하는 reviewed/current/complete 행만 public/AI discovery surface에 포함한다.
- 실제 GPT key 호출·번역 생성·Supabase write·production deploy는 이 artifact 범위가 아니다.

## External gates

- 현재 translation artifact는 448/1,520 rows이며 en=258·ja=238·zh=290·zh-tw=286 rows가 부족하다.
- local Supabase 조회가 `notFound`로 떨어져 authenticated Plus detail panel을 데이터와 함께 관찰하지 못했다.
- 실제 Plus 요청·관리자 큐·완료 알림의 DB 실행과 production migration/RLS/RPC/deploy는 미검증이다.
