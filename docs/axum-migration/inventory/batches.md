<!-- inventory.mjs가 만든 파일. 손으로 고치지 않는다. -->
> **기록 문서.** Next 앱을 옮기기 전의 조사다(L1에서 지움). 지금의 서버는 `server/README.md`.

# 묶음별 크기

UI-PLAN.md가 제안하는 작업 순서대로, 각 묶음이 **새로** 필요로 하는 파일. 앞 묶음에서 이미 센 파일은 다시 세지 않는다. UI 파일은 `app/`·`components/`의 서버·클라이언트 컴포넌트, lib은 그 페이지들이 닿는 `lib/` 모듈(서버 로직 포함)이다. 테스트 파일은 뺐다.

| 묶음 | 페이지 | UI 파일 | 그중 클라이언트 컴포넌트 | lib 파일 | 서버 액션 파일 |
| --- | --- | --- | --- | --- | --- |
| B0 공통 틀 (레이아웃이 얹는 것) |  | 30개 3,313줄 | 18 | 19개 3,567줄 | 3개 1,570줄 |
| B1 정적 문서 | 10: `/about`, `/contact`, `/editorial`, `/guides`, `/guides/[slug]`, `/missing-public-meme`, `/offline`, `/privacy`, `/retired-products`, `/terms` | 20개 2,521줄 | 1 | 41개 5,748줄 | 0개 0줄 |
| B2 목록·탐색 | 17: `/collections`, `/collections/[slug]`, `/explore`, `/global`, `/meme-cards`, `/memes`, `/news`, `/originals`, `/originals/edition/[slug]`, `/quiz`, `/quiz/r/[token]`, `/rankings`, `/search`, `/slang`, `/studio`, `/timeline`, `/weekly` | 48개 8,253줄 | 21 | 30개 3,647줄 | 0개 0줄 |
| B3 밈 문서 (한국어) | 1: `/memes/[key]` | 34개 5,653줄 | 16 | 21개 2,791줄 | 2개 489줄 |
| B4 홈 | 1: `/` | 15개 3,879줄 | 7 | 12개 1,439줄 | 0개 0줄 |
| B5 번역 문서 | 7: `/[locale]`, `/[locale]/explore`, `/[locale]/meme-cards`, `/[locale]/memes/[key]`, `/[locale]/retired-products`, `/[locale]/search`, `/locale-rankings/[locale]` | 7개 1,298줄 | 0 | 4개 237줄 | 0개 0줄 |
| B6 로그인·계정·제보·커뮤니티 | 10: `/community`, `/community/[id]`, `/community/new`, `/forgot-password`, `/login`, `/my`, `/onboarding`, `/reset-password`, `/submit`, `/support` | 29개 5,137줄 | 13 | 7개 1,467줄 | 2개 224줄 |
| B7 운영자 | 20: `/admin`, `/admin/activity`, `/admin/analytics`, `/admin/growth`, `/admin/inquiries`, `/admin/memes`, `/admin/memes/[id]`, `/admin/memes/catalog/new`, `/admin/memes/new`, `/admin/mpe`, `/admin/mpe/[id]`, `/admin/publisher-readiness`, `/admin/radar-safety`, `/admin/reports`, `/admin/sources`, `/admin/submissions`, `/admin/submissions/[id]`, `/admin/translations`, `/admin/users`, `/admin/users/[id]` | 51개 9,122줄 | 20 | 19개 2,234줄 | 7개 2,261줄 |

모든 페이지가 한 묶음에 든다.
