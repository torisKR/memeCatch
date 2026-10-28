# Google 코드 모드 및 기존 공개 영상 재생 검증 — 2026-10-18

## 범위

- `schema` 스킬로 현재 로컬 도마도마 상세 페이지의 실제 JSON-LD를 추출했다.
- 운영 배포, 운영 DB 쓰기/마이그레이션, 영상 업로드/공개, 증거 강제 승인, 신규 서비스 설정은 하지 않았다.
- 애플리케이션 코드 수정은 필요하지 않았다. 이번 변경 파일은 이 검증 기록뿐이다. 기존 미커밋 변경은 보존했다.

## Google 리치 결과 테스트: 실제 실행 완료

대상: `http://127.0.0.1:3020/memes/2au7br9f-도마도마-챌린지` (브라우저에서는 slug가 percent encoding됨).

브라우저에서 렌더된 `script[type="application/ld+json"]` 4개를 추출해 최소 HTML 문서로 감싸고, Google의 **코드** 탭에 입력해 테스트했다. 로컬 URL을 운영 URL로 바꾸거나, 없는 VideoObject를 넣거나, 테스트용 영상 데이터를 추가하지 않았다. 전체 앱 HTML/RSC/인증 정보는 전송하지 않았다.

- 입력 타입: Organization, WebPage, DefinedTerm, BreadcrumbList.
- 입력 길이: 3,308자.
- 입력 SHA-256: `d97311ecaf33b138f20310001c79b42ab0a249fa3df034fc6dcf0fe01b5fcb96`.
- [실제 Google 결과](https://search.google.com/test/rich-results/result?id=oPx8JKj23E4Do8KhdqY09g): **유효한 항목 2개 감지됨**.
- [회사 상세](https://search.google.com/test/rich-results/result/r%2Forganization-info?id=oPx8JKj23E4Do8KhdqY09g): 유효한 항목 1개. 항목을 펼쳐 필드를 확인했고 오류/경고는 표시되지 않았다.
- [탐색경로 상세](https://search.google.com/test/rich-results/result/r%2Fbreadcrumbs?id=oPx8JKj23E4Do8KhdqY09g): 유효한 항목 1개. 홈·분류·현재 문서의 위치/이름/URL을 확인했고 오류/경고는 표시되지 않았다.
- WebPage/DefinedTerm은 결과 화면에 별도 리치 결과 항목으로 나열되지 않았다. 이를 오류로 간주하거나 다른 유형을 추가하지 않았다.
- [Google 결과 스크린샷](../../.local/schema-google-validation-20261018/google-rich-results.jpg).

이 결과는 제출한 **JSON-LD의 코드 모드 결과**다. localhost를 Googlebot이 크롤한 결과, 운영 URL의 접근성/미디어 수집 성공, 색인 또는 검색 노출 보장이 아니다. 입력은 JSON-LD 전용 HTML이므로 실제 화면과의 일치는 별도로 브라우저에서 확인했다.

## 현재 화면과 VideoObject

- 도마도마 상세: 실제 iframe 0개, VideoObject 0개.
- 현재 WebPage.description은 펼칠 수 있는 뜻·유래 본문과, DefinedTerm.description은 상단 한 줄 뜻과 각각 일치함을 확인했다.
- 익명 공개 `public_meme_produced_videos` 조회: HTTP 200, 빈 배열. 조회 실패/미설치로 추정한 것이 아니라 실제 빈 응답을 확인했다.
- 따라서 기존 **공개 자체 제작 영상**으로 양성 사례를 만들 수는 없었다. 테스트를 위해 새 영상을 업로드하거나 검증 값을 조작하지 않았다.

## 기존 공개 원본 영상: 실제 임베드 재생 확인

도마도마에는 공개 콘텐츠 행이 없었다. 대신 기존 승인된 새삥 대표 원본을 사용했다.

- [YouTube 원본](https://www.youtube.com/watch?v=JnQu_5O4lh4), ID `JnQu_5O4lh4`.
- 공개 카탈로그: `availability=live`, `moderation_status=approved`, 대표 콘텐츠.
- 공식 YouTube `videos.list` **1회**로 추가 확인:
  - `privacyStatus=public`
  - `embeddable=true`
  - 게시일 `2022-09-06T16:04:44Z`
  - 채널 `UCsjD7wxKCD8C62_idZQdGJg` (The CHOOM)
  - 길이 `PT1M40S`
- oEmbed 응답 성공만으로 재생 성공을 판정하지 않았다.

현재 로컬 새삥 상세에는 iframe이 렌더되지 않아, 기존 `embedProbeHtml()`만 임시 loopback HTTP 서버에서 제공했다. 서버는 GET `/`만 제공하며 DB/파일 쓰기를 하지 않는다. 헤드리스 CDP 검증기를 실행하는 대신, 브라우저 도구로 실제 privacy-enhanced YouTube iframe을 관찰했다.

- 실제 iframe URL: `https://www.youtube-nocookie.com/embed/JnQu_5O4lh4?enablejsapi=1&autoplay=1&mute=1&playsinline=1&origin=http%3A%2F%2F127.0.0.1%3A3021`.
- 화면의 원본 제목·The CHOOM 채널·진행 시간 및 재생 화면 확인.
- 실제 `<video>` DOM 관찰 1: `currentTime=15.686656`, `paused=false`, `ended=false`, `readyState=4`, `error=null`.
- 실제 DOM 관찰 2: `currentTime=28.597698`, 동일한 정상 상태.
- 진행량: **12.911042초**. ready-only/정지 프레임을 재생 성공으로 취급하지 않았다.
- [실제 재생 스크린샷](../../.local/schema-google-validation-20261018/existing-video-playback.jpg).
- 임시 탭과 재생 서버를 종료했다. 3021 포트에 남은 listener가 없는 것도 확인했다. 기존 3020 개발 서버는 유지했다.

이는 **별도 임시 로컬 iframe의 재생 성공**이며, 현재 새삥 상세 안에서 재생됐다는 주장은 아니다. 이 원본은 자체 제작 영상이 아니고 이번 조회/재생 결과를 DB에 저장하거나 발행 승인 증거로 승격하지 않았다. 원본의 VideoObject도 추가하지 않았다.

## 검증 실패 영상 제외: 회귀 검증

fresh Vitest: **7개 파일, 108개 테스트 통과**.

```sh
pnpm exec vitest run components/json-ld.test.tsx components/meme-produced-videos.test.tsx components/meme-produced-videos.integration.test.tsx lib/video-production/public.server.test.ts 'app/(default)/memes/[key]/page.test.ts' 'app/(default)/memes/[key]/page.renewal.test.ts' 'app/[locale]/memes/[key]/page.test.ts' --reporter=dot
```

검증된 경로는 공개 projection → 실제 server getter → 컴포넌트 HTML/DOM이다. private/unlisted, false/없는/문자열/숫자 proof, 필수 metadata 누락, 다른 영상의 썸네일 ID, 미래 날짜, 잘못된 영상 ID, DB 실패, non-indexable 상세에서 VideoObject가 생성되지 않는 것을 확인했다. 공개·정확한 boolean true·유효 metadata의 양성 fixture에서는 실제 제목/설명/iframe/anchor와 JSON-LD가 일치한다.

fresh Node 프로토콜 테스트: **39개 통과, skip 0**.

```sh
node --test lib/video-production/video-schema.test.mjs scripts/youtube-embed-probe.test.mjs scripts/video-production-worker.test.mjs
```

공식 iframe playback에러, 잘못된 ID, ready-only, pause/freeze, hash 불일치, 새 실패 관찰, 공개 상태 철회/권리 만료 처리 등을 fixture로 확인했다. 테스트 이름에 upload/publish가 있어도 mock 기반 프로토콜 테스트이며 실제 업로드/공개를 실행하지 않았다.

실제 공개 영상의 실패를 만들기 위해 비공개 전환·삭제·오류 유발·운영 데이터 변경을 하지 않았다. 이번 실제 재생 대상은 성공했고, **실패 시 제외 동작은 회귀 테스트로 검증**했다.

## 남은 경계와 롤백

- Google VideoObject의 양성 코드 모드 검증은 미실행: 현재 페이지에 실제 VideoObject가 없으므로 없는 항목을 만들어 제출하지 않았다.
- 로컬 상세의 미디어 필터와 조회/분석 쓰기 차단 환경은 유지했다. 원본 iframe을 강제로 노출시키기 위해 공개 검수 필터를 완화하지 않았다.
- 운영 monitor의 최신성이나 proof TTL 보장은 이번 코드/재생 테스트와 별개다.
- 새 환경변수/DB/의존성/배포 설정 없음. 원치 않으면 이 검증 기록과 `.local/schema-google-validation-20261018/`의 증거 파일만 제거하면 되며, 애플리케이션/데이터 롤백은 필요 없다. 기존 변경 전체를 reset하면 안 된다.
