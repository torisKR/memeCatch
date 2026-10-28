# 밈 상세·읽기 가이드 구조화 데이터 점검 보고서

점검일: 2026-10-12  
대상: 한국어/현지화 밈 상세 페이지, `/guides/reading-memes`  
검증 완료 소스: `schema-62cce611d3e0` (`62cce611d3e09a32eeae6daf8340fc76d97de8ea0cc760eb5773c5ee23662135`)  
이전 운영 배포: `dpl_Cbf12Xhc7kdGxJDbbtQyWCanco4m`  
현재 운영 배포: `dpl_FY57rzndWB2SQhtnxczsCBwiqQnY`

이 운영 검증 기록은 **2026-10-12 릴리스**에 해당한다. 아래 마지막의 **2026-10-13 자체 제작 VideoObject** 변경은 로컬 구현·검증만 완료했으며 운영에 배포하지 않았다.

## 결론

구조화 데이터가 화면에 없는 사실을 보강하는 방식이 아니라, 사용자가 실제로 보는 제목·요약·이동 경로·작성 주체·공개 시각·인용 링크와 같은 값만 나타내도록 교정했다. Google 리치 결과 자격을 얻을 수 있는 타입은 `Article`과 `BreadcrumbList`이며, `DefinedTerm`은 의미 연결을 위한 Schema.org 어휘이지 Google 검색 결과 노출을 보장하는 리치 결과 타입은 아니다.

현재 최종 재검증과 운영 승격 상태는 아래와 같다.

| 검증 항목 | 상태 | 근거 |
| --- | --- | --- |
| 소스·HTML 일치 | 통과 | 가이드 및 밈 3건이 HTTP 200, canonical·H1·JSON-LD 타입 일치 |
| 자동 테스트 | 통과 | 최종 소스에서 전체 Vitest 402개 파일·3,462개 테스트, Node 검증 47건, 변경 범위 집중 테스트 36건 통과. 프로덕션 빌드·TypeScript·변경 파일 ESLint 통과 |
| Google 리치 결과 CODE 검증 | 통과 | 가이드: `Article` 1건·`Breadcrumb` 1건·조직 1건 모두 유효. 조직 중복 URL 경고 해소, `Article.image` 선택 경고만 남음. 밈 상세: `Breadcrumb` 1건·조직 1건 유효, 오류 없음 |
| 이전 스테이징 후보 | 승격 제외 | `dpl_5pppnY97dw8VixMQuXBPab4AdcWv`는 조직 URL 교정 이전 후보이므로 운영 별칭에 승격하지 않는다 |
| 최종 스테이징 검증 | 통과 | HTML 4페이지, 퍼블리셔 UI 16조합, 밈 카드 4뷰포트 통과 |
| 운영 배포·런타임 검증 | 통과 | `catchmeme.com`과 `www.catchmeme.com`이 현재 배포를 가리킴. 운영 HTML 4페이지, 퍼블리셔 UI 16조합, 밈 카드 4뷰포트·별칭 3경로 통과 |
| Google 공개 URL 검사 | 통과 | 실제 Google 모바일 검사 도구가 가이드와 밈 상세 모두 크롤링 허용·페이지 가져오기 성공·색인 생성 허용을 확인. 가이드는 유효 항목 3건, 밈 상세는 유효 항목 2건 감지 |

## 실제 콘텐츠와 맞춘 교정

### 밈 상세

- `WebPage.mainEntity`가 페이지별 단일 `#term`을 참조하고, 별도 `DefinedTerm`이 같은 `@id`와 화면의 한 줄 요약을 정의로 사용한다. 긴 본문과 한 줄 정의가 서로 다른 중복 엔터티로 해석되던 구조를 제거했다.
- `DefinedTerm`과 `DefinedTermSet`은 `Intangible` 계열이므로 `inLanguage`를 붙이지 않았다. 언어 값은 해당 페이지인 `WebPage`에 유지한다.
- 한국어 밈 사전 페이지에는 Google의 제한적인 `speakable` 적용 범위와 맞지 않는 `SpeakableSpecification`을 제거했다.
- `WebPage.breadcrumb`와 `BreadcrumbList`가 페이지별 안정적인 `#breadcrumb` ID로 연결된다.
- 한국어와 현지화 상세 화면에 실제 이동 경로를 표시하고, 레거시 카테고리는 표시용 카테고리와 URL을 같은 규칙으로 해석한다. JSON-LD의 이름과 사용자가 보는 경로가 일치한다.
- 사용되지 않는 영상 헬퍼에서 YouTube 시청 페이지를 직접 미디어 파일인 `contentUrl`처럼 출력하던 값을 제거하고, 11자리 영상 ID와 근거가 있는 업로드 시각이 모두 있을 때만 `VideoObject`를 만들도록 제한했다. 현재 상세 페이지에는 근거 없는 `VideoObject`를 새로 추가하지 않았다.

### 밈 읽기 가이드

- 실제 H1·설명·작성 주체·공개 시각·화면에 노출된 근거 링크를 사용해 `Article`, `WebPage`, `BreadcrumbList`를 연결했다.
- 작성자는 화면의 “밈캐치 편집” 표기와 `/about` 링크에 대응하는 밈캐치 조직으로 표현했다.
- `datePublished`는 임의의 자정이 아니라 앞선 운영 공개 별칭 이벤트에서 확인한 `2026-10-12T18:34:36+09:00`을 화면과 JSON-LD에 함께 사용했다.
- 인용은 화면에서 직접 확인 가능한 The CHOOM 영상, CJ 뉴스룸 설명, 교정된 새삥 상세 링크 3건으로 한정했다.
- 가이드 전용 대표 이미지, 수정일, 영상 객체는 근거가 없으므로 만들지 않았다. 따라서 Google이 권장하는 선택 필드 경고가 남을 수 있으나, 경고를 없애기 위해 사실을 발명하지 않는다.

## Google 리치 결과 점검

최종 소스의 HTML을 Google 리치 결과 테스트의 **코드 입력 방식**으로 검증했다. 가이드는 유효 항목 3개(`Article` 1건, `Breadcrumb` 1건, 조직 1건)를 인식했고 치명적 오류는 없었다. 같은 `#org` 엔터티를 전역 조직에서는 루트 URL로, 가이드 작성자에서는 `/about` URL로 표현해 발생했던 조직 중복 URL 선택 경고는 작성자 URL을 루트 URL과 일치시킨 뒤 해소됐다. `Article`에는 실제 대표 이미지가 없어 `image` 선택 입력란 경고 1건만 남았다. 날짜 형식·시간대에 관한 초기 경고도 검증된 운영 공개 시각 `2026-10-12T18:34:36+09:00`을 적용한 최종 검사에서 해소됐다.

밈 상세 최종 코드 검증에서는 유효한 `Breadcrumb` 1건과 조직 1건을 인식했고 오류 및 선택사항 표시는 없었다. Google 리치 결과 대상이 아닌 ID 없는 중복 `DefinedTerm`은 별도 의미 점검에서 발견했으며, 현재는 한 개의 안정적인 `#term`으로 통합했다.

중요: 리치 결과 테스트의 “유효” 판정은 Google이 해당 표현을 검색 결과에 반드시 표시한다는 보장이 아니다. 페이지 품질, 색인 가능성, 검색어와의 관련성, Google 시스템 판단이 별도로 적용된다.

최종 Google CODE 검증 결과: **통과**  

- 가이드 결과: [oVzLYNjsI0e6Err4eIeL1w](https://search.google.com/test/rich-results/result?id=oVzLYNjsI0e6Err4eIeL1w) — `Article` 1건, `Breadcrumb` 1건, 조직 1건 모두 유효. 조직 중복 URL 경고 해소. 실제 대표 이미지가 없어서 `Article.image` 선택 경고 1건만 남음.
- 밈 상세 결과: [7HNTm_0v7YicPxWH9e3J2w](https://search.google.com/test/rich-results/result?id=7HNTm_0v7YicPxWH9e3J2w) — `Breadcrumb` 1건, 조직 1건 유효, 오류 없음.

최종 운영 URL 검증 결과: **가이드·밈 상세 모두 통과**  

- 가이드 공개 URL 결과: [pLNk53fU59NGFmFiz3TLAQ](https://search.google.com/test/rich-results/result?id=pLNk53fU59NGFmFiz3TLAQ) — 2026-10-12 22:01:09 KST에 Google 검사 도구 스마트폰으로 크롤링 완료. 크롤링 허용, 페이지 가져오기 성공, 색인 생성 허용. `Article` 1건, `Breadcrumb` 1건, 조직 1건 유효하며 조직 경고는 없고 `Article.image` 선택 경고만 남음.
- 밈 상세 공개 URL 결과: [ODk73yaEcOf-TlaA32L6vg](https://search.google.com/test/rich-results/result?id=ODk73yaEcOf-TlaA32L6vg) — 2026-10-12 22:05:38 KST에 Google 검사 도구 스마트폰으로 크롤링 완료. 크롤링 허용, 페이지 가져오기 성공, 색인 생성 허용. `Breadcrumb` 1건과 조직 1건이 유효하며 오류·선택 경고 없음.

두 URL 모두 첫 시도에서는 원인 세부 정보 없는 일반 오류가 반환됐으나 새 검사에서 정상 완료됐다. 초기 오류는 재시도로 해소된 일시적 관찰이며 남은 배포 차단점이 아니다.

## 검증 근거

- [최종 소스 상태](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/source-final4/release-state.json)
- [최종 소스 파일 해시 목록](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/source-final4/source-manifest.json)
- [분리 배포 패키지 검토](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-package-review.json)
- [로컬 최종 HTML 검증 보고서](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-local-html/report.json)
- [가이드 추출 JSON-LD](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-local-html/guide.json)
- [새삥 상세 추출 JSON-LD](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-local-html/89b37mrx.json)
- [가이드 모바일·모션 감소 UI 증거](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-local-ui/publisher-page-qa-ZExqEr/mobile-390x844-reduced-guides-reading-memes.png)
- [가이드 Google CODE 결과](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/google/guide-code-organization-fixed.txt)
- [가이드 Article 세부 결과](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/google/guide-code-organization-fixed-article.txt)
- [밈 상세 Google CODE 결과](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/google/meme-code-final.txt)
- [최종 스테이징 배포 생성 기록](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/deployment-final-created.json)
- [운영 별칭 승격 결과](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/aliases-after-promotion.json)
- [스테이징 HTML 검증](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-staged-html/report.json)
- [스테이징 퍼블리셔 UI 검증](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-staged-ui/publisher-page-qa-c1iKrT/report.json)
- [스테이징 밈 카드 검증](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-staged-card-ui/meme-card-qa-9X8nKm/report.json)
- [운영 HTML 검증](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-production-html/report.json)
- [운영 퍼블리셔 UI 검증](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-production-ui/publisher-page-qa-Yqe9Q2/report.json)
- [운영 밈 카드 검증](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/final4-production-card-ui/meme-card-qa-meCL4c/report.json)
- [가이드 Google 공개 URL 최종 결과](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/google/guide-live-url-final.txt)
- [가이드 Google 크롤링 상세](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/google/guide-live-url-crawl.txt)
- [가이드 Article 공개 URL 세부 결과](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/google/guide-live-url-article.txt)
- [밈 상세 Google 공개 URL 최종 결과](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/google/meme-live-url-final.txt)
- [밈 상세 Google 크롤링 상세](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/google/meme-live-url-crawl.txt)
- [GoogleInspectionTool 사용자 에이전트 진단](/Users/toris/projects/memecatch/artifacts/release/20261012-structured-data/inspection-user-agent-check.json)

브라우저 UI 검증은 320×568, 375×812, 390×844 모션 감소, 1440×900 환경을 **에뮬레이션**해 16개 페이지 조합에서 수행했다. 가로 넘침·런타임 오류·콘솔 오류·광고 요청은 0건이었으며, 물리 모바일 기기 검증으로 해석하지 않는다.

운영 퍼블리셔 검증에는 브라우저가 보고한 기존 `Permissions-Policy` 경고 16건이 남아 있지만 런타임 오류·콘솔 오류·네트워크 실패는 0건이었다. `GoogleInspectionTool` 사용자 에이전트만 재현한 직접 공개 GET은 두 페이지 모두 HTTP 200, 기대 릴리스, JSON-LD 존재, `X-Robots-Tag` 차단 없음으로 확인됐다. 이 보조 진단 자체는 검증된 Google 서버 IP 요청이 아니지만, 이후 실제 Google URL 검사에서 두 페이지 모두 가져오기·색인 허용까지 통과했다. 남은 구조화 데이터 확인 항목은 실제 대표 이미지가 없어 발생하는 가이드 `Article.image` 선택 경고다. 구조화 데이터의 유효 판정은 검색 결과 노출, 색인, AdSense 승인 여부를 보장하지 않는다.

초기 QA에서 간헐적으로 관찰된 빈 화면은 콘텐츠 누락이 아니라 Next RSC 스트리밍 중 숨겨진 DOM을 너무 일찍 판정한 대기 조건 경쟁으로 확인했다. 검증기가 실제 제목·카드·경로가 보일 때까지 기다리고 한국어 `Accept-Language`를 사용하도록 교정했으며, 이 조건은 Node 회귀 테스트에 포함했다.

## 변경 파일

- `components/json-ld.tsx`
- `components/json-ld.test.tsx`
- `app/(default)/guides/reading-memes/page.tsx`
- `app/(default)/guides/reading-memes/page.test.tsx`
- `app/(default)/memes/[key]/page.tsx`
- `app/(default)/memes/[key]/page.test.ts`
- `app/[locale]/memes/[key]/page.tsx`
- `app/[locale]/memes/[key]/page.test.ts`
- `scripts/qa-publisher-pages.mjs`
- `scripts/qa-publisher-pages.test.mjs`

## 적용 기준

- [Google Article 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google Breadcrumb 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb)
- [Google 구조화 데이터 일반 정책](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google speakable 구조화 데이터](https://developers.google.com/search/docs/appearance/structured-data/speakable)
- [Schema.org DefinedTerm](https://schema.org/DefinedTerm)
- [Schema.org inLanguage](https://schema.org/inLanguage)

## 배포 기록

이전 스테이징 후보 ID: `dpl_5pppnY97dw8VixMQuXBPab4AdcWv`  
이전 스테이징 후보 URL: [memecatch-ag4bpdxzm-ironjustlikethatgmailcoms-projects.vercel.app](https://memecatch-ag4bpdxzm-ironjustlikethatgmailcoms-projects.vercel.app)  
이전 스테이징 후보 상태: **조직 URL 교정 이전 후보로 운영 승격 제외**  
최종 스테이징 배포 ID: `dpl_FY57rzndWB2SQhtnxczsCBwiqQnY`  
최종 스테이징 URL: [memecatch-bpny4r8j0-ironjustlikethatgmailcoms-projects.vercel.app](https://memecatch-bpny4r8j0-ironjustlikethatgmailcoms-projects.vercel.app)  
최종 스테이징 상태: **HTML·퍼블리셔 UI·밈 카드 검증 통과 후 운영 승격 완료**  
운영 배포 ID: `dpl_FY57rzndWB2SQhtnxczsCBwiqQnY`  
운영 URL: [https://catchmeme.com](https://catchmeme.com), [https://www.catchmeme.com](https://www.catchmeme.com)  
운영 릴리스 헤더: `schema-62cce611d3e0`  
Google 공개 URL 검사: **가이드·밈 상세 모두 통과**

## 2026-10-13 자체 제작 VideoObject — 로컬 구현·검증만

범위: 한국어·현지화 밈 상세의 자체 제작 설명 영상. 운영 배포·운영 DB 마이그레이션·영상 업로드·공개 전환·계정 설정 변경은 수행하지 않았다. 이 절의 결과는 위의 2026-10-12 운영/Google 검사와 별개다.

### 발견과 수정

기존 상세 페이지는 자체 제작 영상 iframe을 표시했지만 해당 영상의 VideoObject는 출력하지 않았다. 공개 조회에는 실제 재생 검증 증거와 YouTube 제목·썸네일·공개 시각도 없었다. 단순히 사이트 연결 상태나 승인값만으로 VideoObject를 추가하지 않고, 다음 조건을 모두 만족하는 별도 경로를 구현했다.

| 조건 | 출력 기준 |
| --- | --- |
| 사이트와 승인 상태 | `site_linked`, 처리 성공, live/approved 콘텐츠, 현재 권리 유효, 재선정 차단 없음 |
| 영상 동일성 | 제작물·제작 승인·게시 승인·게시물·임베드 검증의 아티팩트 해시 일치 |
| 실제 공개 | 저장된 실제 privacy와 승인 visibility 모두 `public`; `unlisted`는 VideoObject 제외 |
| 실제 재생 증거 | 동일 게시물·제작물·영상 ID·아티팩트에 대한 최신 완료 normal sync/monitor의 `embedVerified=true`, 처리 성공, public, embeddable 증거 |
| 필수 메타데이터 | 실제 YouTube API snippet의 제목, 해당 영상 썸네일, 시간대가 있는 실제 공개 시각 모두 유효 |
| 상세 페이지 | 색인 가능한 상세만 출력; JSON-LD의 제목·설명·embedUrl이 보이는 영상과 일치 |

- 최신 완료 증거가 실패하거나 누락되면 오래된 성공 증거를 다시 선택하지 않는다. 캐시 갱신 전용 잡은 재생 증거로 인정하지 않는다.
- normal sync는 익명 재생 성공 후 YouTube 상태를 다시 읽어 영상·채널·처리·공개·임베드 허용을 확인한 뒤 메타데이터를 저장한다. linked monitor 역시 실제 재생 증거가 성공한 경우에만 메타데이터를 저장한다.
- 익명 재생 프로브는 상세/JSON-LD와 같은 `youtube-nocookie.com` iframe을 만들고, 기존 iframe에 공식 IFrame API를 연결한다. ready만으로 통과하지 않고 정확한 영상 ID, PLAYING 상태, 재생 시간의 실제 증가를 요구한다.
- 썸네일은 API가 크기 60×30 이상으로 제공한 실제 항목만 선택한다. 필수 값 누락, 잘못된 날짜, 다른 영상 썸네일, 인증·서명 URL은 전체 VideoObject 생략으로 처리한다.
- 화면에는 실제 영상 제목·설명을 표시하고, schema `@id`는 해당 영상 DOM 앵커를 사용한다. 같은 영상 ID의 중복 iframe/VideoObject는 제거한다.
- DB 생성일·사이트 연결일·렌더 포스터·추측 썸네일을 대체값으로 쓰지 않는다. 직접 미디어 바이트 URL이 없으므로 `contentUrl`을 만들지 않으며, 검증하지 않은 `duration`도 추가하지 않는다.
- 자체 제작 영상은 유래의 원본 영상이나 인용 근거로 넣지 않는다. 공개 DTO는 메타데이터만 허용하고 작업 원문·승인자·해시·비밀 업로드 주소는 노출하지 않는다.
- 미적용 뷰/컬럼에 대한 명시적인 호환 처리 외의 조회 장애는 민감정보 없는 고정 실패 단계 로그로 구분한다. 장애 시에는 VideoObject를 안전하게 생략한다.

### 최신 로컬 검증

| 검증 | 결과 |
| --- | --- |
| 집중 Vitest | 16개 파일, 188/188 통과 — 영상 DTO·schema·SSR HTML·한국어/현지화 경로·관리자/API·원본 출처 분리 회귀 포함 |
| 영상 Node 프로토콜 | 98/98 통과 — API 메타데이터·게시 상태 재확인·익명 재생 증거·동일 privacy-enhanced iframe 계약 포함 |
| 격리 PostgreSQL 공개 뷰 | 실제 SQL 트랜잭션 검증 통과 후 rollback — public 양성, unlisted/private, 최신 실패 우선, stale hash, 메타데이터 누락 확인; 서버 재중지 |
| 변경 파일 ESLint / diff check | 통과 |
| 독립 변경 검토 | 승인 — 공개 증거, 메타데이터, 화면 일치, XSS·비밀정보 경계 및 오류 처리 검토 |
| 전체 TypeScript | 기존 `harvest-memes` Next route 오류 2건으로 실패; 이번 변경 범위 진단 없음 |

TypeScript 잔여 오류는 기존 route의 허용되지 않은 `HARVEST_CANDIDATE_POOL` export와 `POST`의 선택적 `Request` 인자다. 해당 무관한 코드는 수정하지 않았다.

실제 YouTube API·공개 영상 재생·Google 리치 결과 검사·썸네일의 Googlebot 접근은 이번 로컬 검증에서 실행하지 않았다. 테스트의 검증 완료 영상은 픽스처이며 실제 게시 승인이나 실제 채널 검증을 뜻하지 않는다. 전체 DB 마이그레이션 체인과 pgTAP도 실행하지 않았으며, 구조화 데이터의 문법/계약 통과가 검색 노출을 보장하지 않는다.

주요 변경 파일: `lib/video-production/video-schema.*`, `public.server.*`, `youtube-api.*`, `components/json-ld.*`, `meme-produced-videos.*`, 한국어/현지화 밈 상세 페이지·테스트, `scripts/video-production-worker.*`, `youtube-embed-probe.*`, 영상 마이그레이션의 공개 뷰·계약 테스트.

격리 DB 근거: [공개 뷰 로컬 검증](/Users/toris/projects/memecatch/docs/operations/video-public-projection-verification.md), [롤백 SQL](/Users/toris/projects/memecatch/supabase/tests/video_public_projection.local.sql).

적용한 공식 기준: [Google VideoObject](https://developers.google.com/search/docs/appearance/structured-data/video), [Google 영상 색인](https://developers.google.com/search/docs/appearance/video), [YouTube 기존 iframe API](https://developers.google.com/youtube/iframe_api_reference), [YouTube privacy-enhanced 임베드](https://support.google.com/youtube/answer/171780?hl=en).
