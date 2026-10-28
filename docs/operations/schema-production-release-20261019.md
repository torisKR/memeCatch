# 밈 상세 JSON-LD 선택 배포 — 2026-10-19 KST

## 승인 범위

최신 사용자 요청인 “검증 후 배포까지”에 따라 검증된 스키마 웹 변경만 운영에 적용한다.
DB 마이그레이션, 콘텐츠 승인/덮어쓰기, 영상 업로드/공개, 제작 워커, Paddle 및 프로젝트 공용 환경변수 변경은 포함하지 않는다.
루트 미커밋 변경 전체를 배포하지 않고 현재 운영 상세 UI 동결본 위에 필요한 의존성만 조립했다.

## 릴리스 식별

- 기존 운영 배포: `dpl_3RHw5gV1g4rquG6SD6bEficzQP67` / `detail-ui-c45da68b9111`
- 검증 전용 SOURCE: `/private/tmp/memecatch-schema-source.v6Np1A` (배포 입력 아님)
- 유일한 배포 입력 BUILD: `/private/tmp/memecatch-schema-build.tsF4Df`
- 새 릴리스: `schema-video-dfd210e89545`
- BUILD: 1,811개 항목, SHA-256 `9560b78fd3675b690e08b5aa8f23bf406d2e4a911e3e7f61d699d3b916421db4`
- 선택 델타: 19개 경로. `artifacts/release/20261019-schema/assembly/final3/changed-files.txt` 참조.
- 도메인 미연결 배포: `dpl_G2mQDPdqQ6J6w7uHkJv92Ecrfvof`
- 배포 URL: `https://memecatch-11e2nrlqc-ironjustlikethatgmailcoms-projects.vercel.app`
- 운영 승격 완료: 2026-10-19 01:12:23 KST. `catchmeme.com` alias가 위 새 READY 배포를 가리킴을 공급자 조회로 확인.
- 공개 URL 사후 점검 완료: 2026-10-19 01:12:58 KST. 상세 4곳 모두 HTTP 200 및 `X-MemeCatch-Release-Sha: schema-video-dfd210e89545`.

`assembly/`, `assembly/final/`, `assembly/final2/`는 중간 진단 기록이다. 배포 입력과 검증의 근거로는 `assembly/final3/`만 사용한다.

## 포함된 변경

- `components/json-ld.tsx`: 실제 서비스 범위에 맞는 Organization 설명. 사용되지 않던 일반 영상 helper를 검증된 자체 설명 영상 전용 helper로 교체.
- `components/meme-produced-videos.tsx`: 보이는 제목/설명/iframe URL과 VideoObject가 같은 메타데이터/helper를 사용.
- `lib/video-production/public.server.ts`: 공개 뷰의 public 행만 허용. 누락 뷰/컬럼 및 DB 오류는 빈 결과로 닫고, 민감한 공급자 상세 대신 제한된 실패 단계만 기록.
- `lib/video-production/video-schema.mjs` 및 타입 선언: 11자 영상 ID, 영상과 일치하는 허용 썸네일, 실제 유효한 비미래 업로드 시각, 제목/선택 설명 검증.
- 한국어·다국어 상세 라우트: 기존 화면·도구·canonical·안전 신호·Life signal은 유지하며 최소 조회/렌더 연결만 추가.
- `lib/supabase/public-catalog-cache.ts`: 정확한 익명 공개 영상 projection만 기존 Data Cache 경계에 추가. `force-cache`, 60초, 기존 태그 사용. 페이지 전체를 force-dynamic으로 바꾸지 않음.
- `.vercelignore`: 중첩 `.mcp.json` 제외. 기존 `.mcp.local.json` 제외 유지.
- 관련 단위/통합/선택 배포 경계 테스트.

## VideoObject 출력 조건

모두 충족해야 한다.

1. 공개 뷰를 통해 조회된 `privacy_status === "public"` 행.
2. 저장된 공개·임베드 재생 검증 값 `public_embed_verified === true` (문자열/숫자는 불가).
3. 유효한 실제 영상 ID·제목·썸네일·업로드 날짜.
4. 해당 상세 문서가 색인 가능 상태.
5. 화면에 표시하는 iframe URL과 JSON-LD의 embedUrl이 동일.

원본 참고 링크/대표 콘텐츠가 존재한다는 사실만으로 VideoObject를 만들지 않는다.
private/unlisted/미검증/오류/유효하지 않은 메타데이터는 VideoObject에서 제외한다.

## 사전 검증

- Vitest 10개 파일, 134개 테스트 통과.
- 네이티브 영상 스키마 테스트 5개 통과, 스킵 0.
- 전체 TypeScript 검사 및 대상 ESLint 통과.
- Next.js 16.3.4 production build 성공, 정적 페이지 111/111 생성.
- 한국어 도마도마/새삥/Whiplash 및 영어 Chicken Jockey 상세 HTTP 200·동일 릴리스 헤더 확인.
- CUA 브라우저에서 한국어/영어 h1 및 보이는 설명과 WebPage/DefinedTerm 설명 일치 확인.
- Google Rich Results Test 코드 모드: 유효 항목 2개(Organization, BreadcrumbList).
  결과: https://search.google.com/test/rich-results/result?id=UjDpYg49-v3xkbKD01frWg
  WebPage/DefinedTerm은 이 도구의 독립 리치 결과 항목으로 표시되지 않음. 색인·검색 노출을 보장하는 결과가 아님.
- 운영 공개 영상 뷰: anon GET HTTP 200, 빈 배열(0건). 조회 실패를 0건으로 오인하지 않음.
  따라서 실서비스 자체 제작 영상의 긍정 VideoObject 경로는 이번에 실데이터로 재현하지 못했으며 통합 테스트로 검증했다.
- Vercel dry-run: 업로드 1,807개 파일, 금지 경로/키 패턴 0건. 비밀키 값은 출력하지 않음.
- SOURCE 빌드/테스트 후에도 배포 BUILD와 기존 운영 동결본 지문 불변.

## 배포 전 발견·수정한 문제

- 첫 로컬 빌드는 샌드박스 DNS 제한으로 공개 DB 사이트맵 조회에서 실패. 공개 anon 읽기만 허용한 네트워크 실행으로 재검증.
- 업로드 목록의 중첩 MCP 설정 파일을 발견해 제외 규칙 보완. 해당 파일을 포함한 배포는 실행하지 않음.
- FINAL2 production 로컬 실행에서 새 영상 조회가 no-store로 처리되어 static-to-dynamic HTTP 500 발생. 누락된 공개 카탈로그 캐시 의존성을 FINAL3에 포함하고 실제 SDK 요청으로 RED→GREEN 확인. FINAL2는 운영에 배포하지 않음.
- noindex 문서는 기존 계약대로 Organization/BreadcrumbList만 출력하므로, 점검 코드도 색인 상태와 JSON-LD 출력의 일치를 검사하도록 수정.

## 검증 한계·기존 별도 과제

- 로컬 서버는 공개 anon 설정만 전달하고 비GET/HEAD/OPTIONS fetch를 차단했다. 기존 미디어 ledger의 읽기 RPC도 POST이므로 차단되어 로컬 참고 영상은 운영과 다를 수 있다. 보호된 배포본과 공개 운영 응답에서는 Whiplash 참고 영상 `PRHgGhd7nW8` 및 “챌린지 원본이나 독립 확산 근거가 아닙니다.” 문구가 모두 보존됨을 확인했다.
- 로컬 빌드의 기존 metadataBase 경고와 home-editorial 제한 조회 로그는 이 선택 델타와 별개이며, 전체 홈/결제/관리자 워크플로를 새로 검증했다는 뜻은 아니다.
- 과거 SQL 정의에 unlisted 행을 anon 뷰에서 조회할 수 있는 별도 DB 개인정보 노출 위험이 남아 있다는 검토 사항이 있다. 현재 공개 뷰 조회는 빈 배열이다. 이번에는 DB 변경을 승인 범위에 넣지 않았으며 웹 경계는 public만 허용한다.
- 기존 공개 원본 영상 `JnQu_5O4lh4`의 공개 상태/임베드 재생 증거는 `schema-google-validation-20261018.md`에 있다. 이번 작업에서 새 영상 업로드·공개, 원본 다운로드는 수행하지 않는다.

## 배포 증거

- `artifacts/release/20261019-schema/deployment/local-verification-final.json`
- `artifacts/release/20261019-schema/deployment/local-browser-checks.json`
- `artifacts/release/20261019-schema/deployment/upload-safety-final3.json`
- `artifacts/release/20261019-schema/deployment/public-projection-read.json`
- `artifacts/release/20261019-schema/deployment/staged-deployment.json`
- `artifacts/release/20261019-schema/deployment/staged-http-checks.json`
- `artifacts/release/20261019-schema/deployment/promotion-result.json`
- `artifacts/release/20261019-schema/deployment/live-http-checks.json`
- `artifacts/release/20261019-schema/deployment/live-browser-checks.json`
- `artifacts/release/20261019-schema/deployment/live-schema-semantic-comparison.json`
- `artifacts/release/20261019-schema/deployment/production-detail.png`
- `artifacts/release/20261019-schema/deployment/google-code-result.png`

보호된 스테이지와 공개 운영 응답 모두 도마도마·새삥·영어 Chicken Jockey는 색인 가능 상태와 Organization/WebPage/DefinedTerm/BreadcrumbList를 유지한다. Whiplash는 기존 운영과 같은 noindex 및 Organization/BreadcrumbList를 유지한다. `VideoObject`는 네 페이지 모두 0개다.

CUA로 운영 도마도마 화면을 직접 열어 h1/요약/본문 설명과 JSON-LD를 다시 비교했다. 코드 모드에 제출한 로컬 production JSON-LD와 운영 JSON-LD는 객체 속성 순서가 일부 달라 원시 직렬화 문자열은 다르지만, 객체 키만 정렬하고 배열 순서는 유지한 비교에서 모든 값이 동일했다. 관련 두 결과를 각각 보존했다. 검색엔진 색인 또는 영상 리치 결과 획득을 보장한다고 해석하지 않는다.

실행한 운영 변경은 단일 웹 배포 생성과 그 동일 배포의 운영 승격뿐이다. DB 쓰기·영상 업로드·공개 전환·출처 승인·프로젝트 공용 환경변수 변경은 0건이다.

## 롤백

문제 발생 시 기존 READY 배포 `dpl_3RHw5gV1g4rquG6SD6bEficzQP67`를 동일 프로젝트에서 다시 promote한 뒤 catchmeme.com alias 및 릴리스 헤더를 확인한다.
DB/기존 콘텐츠를 변경하지 않았으므로 이 웹 릴리스 롤백에 DB 역마이그레이션은 필요하지 않다.
이 문서는 롤백 방법을 기록할 뿐, 롤백을 실행한 기록은 아니다.
