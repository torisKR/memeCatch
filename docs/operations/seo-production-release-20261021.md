# SEO·GEO·AEO / Gateway 제거 웹 릴리스 — 2026-10-21

## 승인과 범위

2026-10-21 사용자의 커밋·푸시·운영 배포 요청에 따른 웹 릴리스다.
앞선 `seo-gateway-removal-20261021.md`와 `seo-geo-aeo-readiness-20261021.md`는
당시의 **로컬 검증 기록**이며, 운영 적용 상태는 이 기록에서 별도로 추적한다.

- 릴리스 브랜치: `codex/seo-readiness-gateway-removal-20261021`.
- 시작 Git 기준선: `26ff7783cb6e051418ef6246e9bfb484fef15d62`.
- 기존 운영 배포: `dpl_6VNcGNmQ5Xt8aFXossTYPX6arxhg`.
- 기존 운영 소스 manifest: `0dae4504ca23796656f7e3825471f965adfdd668856d99af7b0b98032d9f7206`.
- 임시 폴더가 소실돼 기존 manifest와 로컬/Git 파일을 대조하고, 부족한 파일은
  인증된 Vercel 소스 읽기 API로 복구했다. 공개 애플리케이션 기준 파일 1,789개를 검증했다.
- Git에 없지만 이미 운영 중인 의존성은 해당 운영 소스와 일치하는 내용으로 포함한다.
  기존 홈 탐색 구현, 공개 영상 read lane, 수집·검수 기본 동작을 새 기능으로 오인하지 않는다.
- 이번 델타는 한국어 canonical, 번역 커버리지, 공개 projection, 크롤 가능한 탐색 링크,
  실제 화면과 일치하는 스키마, 상세 정보 순서, 게시자 사람 검수 진단, Gateway 호출 제거다.

기존 작업 폴더는 덮어쓰지 않는다. 기존 운영의 배포별 안전 설정을 유지하기 위해
릴리스 브랜치를 푸시하고 수동 staged production 배포 후 검증·승격한다.
`main`에 대한 별도 Git 자동 운영 배포는 실행하지 않는다.

## 실행하지 않는 작업

- 운영 DB 마이그레이션, DB 테스트/시드/일괄 수정, 실제 검수 승인 액션.
- 새 Supabase migration·SQL 계약 파일을 이번 커밋에 추가하는 작업.
- Vercel 공유 환경변수, API 키, 결제·광고 계정 설정 변경.
- Paddle 경로/호스트 rewrite, 영상 제작 워커·업로드·공개, 유료 서비스 추가.
- AdSense 광고 활성화·광고 클릭·재심사 제출 또는 합격 주장.

기존 배포별 안전 설정을 그대로 전달한다:
`MEME_LAYA_ROUTING_ENABLED=false`, `MEME_CHAT_GENERATION_ENABLED=false`,
`SOURCE_REFRESH_ENABLED=false`, `SOURCE_REVIEW_ATOMIC_ENABLED=true`.
이전 Laya 플래그가 남아 있어도 분류기는 외부 Gateway 요청을 하지 않는다.
새 환경변수·새 키는 필요하지 않다. `.env.example`의 생성 경로 기본값도 false다.

## 배포 전 증거

- Node 24: 전체 Vitest **449파일, 4,044개 통과, 2개 건너뜀**.
- TypeScript `--noEmit --incremental false`: 통과.
- 애플리케이션 ESLint: 오류 0, 기존 이미지 경고 6.
- Next.js 16.3.4 webpack 프로덕션 빌드: 종료 0, 정적 페이지 111개 생성.
- QA 도구 Node 테스트: 최종 32개 통과.
- `git diff --cached --check`: 통과.
- 스테이징된 diff Gitleaks 검사: 비밀정보 발견 없음.

원격 업로드 대상에서는 단위 테스트와 내부 `docs/superpowers/` 기획서를 제외한다.
기존 테스트 상수의 키 형식 경고를 런타임 자격으로 오인하거나 값 자체를 보고하지 않으며,
실제 배포 파일의 hash와 비밀정보 검사를 별도로 수행한다. 키 회전·계정 변경은 하지 않는다.

복구된 예전 릴리스 전용 테스트 4개는 당시의 premium 섹션·직접 import 구조를 고정하는
일회성 검사여서 새 소스에 추가하지 않았다. 실제 상세 페이지/JSON-LD/공개 영상 gate 테스트로
현재 계약을 검증한다. 기존 홈의 중복 검색 제거와 동적 홈 메타데이터에 맞춰 회귀 테스트를
정합화했으며, 별도 미완료 홈 리디자인은 포함하지 않았다.

로컬 빌드는 공개 DB 자격만 전달했다. 서버 자격은 전달하지 않았으므로 공개 미디어 원장과
홈 추천 조회 경고가 남는다. 다른 정적 경로의 기존 metadataBase fallback 경고도 남는다.
빌드 성공을 운영 원장/실제 공개 영상 재생 검증 성공으로 해석하지 않는다.

## 배포 상태

- **운영 승격 완료:** 2026-10-21 17:26:24 KST.
- 운영 URL: https://catchmeme.com/
- 배포 ID: `dpl_4N7QybBodrEVeZJiRbPxsW2S3i36`, `READY`.
- 실제 배포한 앱/패키징 커밋: `d56cb138f2bdb77c5fb9137c0e730dba5d8e4116`.
  주요 기능 커밋은 `bb4d3eafcec18248710d5b9fcfdecb2e847ea226`이다.
- Git archive로 고정한 소스의 원격 업로드 파일 1,279개를 SHA-1로 대조했다.
  스테이징 diff와 실제 앱 업로드 대상의 Gitleaks 검사는 모두 통과했다.
- 처음 구성한 미연결 배포는 상위 작업 폴더의 예전 Git 식별자가 자동 첨부돼 중단했다.
  저장소 밖의 동일 archive와 명시적 커밋 정보로 재배포했으며 이전 운영 도메인은
  검증 완료 전까지 계속 기존 READY 배포를 유지했다. 이 작업의 중복 preview도 중단했다.
- Vercel 팀 공유 설정·환경변수·키·결제·광고 계정은 변경하지 않았다.
  기존 automation 접근 자격만 staged 브라우저 검사에 사용했고, 새 키를 만들지 않았다.
  모드 0600 임시 접근 파일은 검증 후 삭제했다. 운영 공개 검사는 우회 자격 없이 수행했다.
- `main`은 변경하지 않았다. 릴리스 브랜치의 수동 운영 배포이며, 불완전한 기본 Git
  자동 배포가 기존 배포별 안전 설정을 덮어쓰지 않도록 별도 승격했다.

### 운영 브라우저 증거

- 로그인하지 않은 격리 Chrome에서 홈·읽기 가이드·소개·탐색·새삥 상세를
  320×568, 375×812, 390×844(reduced motion), 1440×900으로 확인했다.
- **20개 화면 모두 HTTP 200**, 응답의 release 식별자가 배포 커밋과 일치했다.
  가로 넘침 0, 광고 스크립트 0, JSON-LD 파싱 오류 0이다.
- 모션 감소 5개 화면에서 실행 애니메이션 0개, 설정 일치를 확인했다.
- 데스크톱 Enter로 유래·자료를 펼치고 출처 링크에 초점을 옮겼다.
  무JavaScript에서도 서버 HTML의 제목·요약·JSON-LD가 유지됐다.
- 콘솔 error·런타임·네트워크·자동화 control 오류는 모두 0개다. 기존
  Permissions-Policy `tools` origin-trial 등 warning 21개는 남는다.
- QA 도구는 실제 카드의 `li` 링크만 세도록 정정했다. 미리보기 링크를 카드로
  오인하던 검사 오류를 앱 오류로 보고하지 않는다. 탐색은 요청한 interactive 문서와
  보이는 H1을 함께 기다린다. 무JS DOM snapshot의 정확한 stale-node 오류만 기존
  제한 안에서 재시도하며, 네트워크·권한·애플리케이션 오류는 숨기지 않는다.
  최종 무JS 검사에서 해당 문서 전환 race가 1회 재시도됐다.
- Aside 공개 브라우저에서도 `/`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`,
  도마도마 상세, `/explore?page=2`의 200을 확인했다. 새삥 GET 검색은 실제 상세 링크를
  반환했고, 홈의 AI 전송 문구는 없으며 canonical/ko/x-default는 한국어 홈이다.
  사이트맵 XML의 loc는 1,032개, 한국어 llms 안내 대상은 441개로 관찰됐다.
  이는 페이지 공개 조건 통과 수이며 독립적 사실·권리 검수 완료 건수가 아니다.
- 새삥 원본 iframe 1개와 제작 `VideoObject` 0개를 구분했다. 공개 제작 영상의 실제
  양성 재생 검증은 이번에도 수행하지 않았다. 영상 업로드·공개는 하지 않았다.
- 기존 `%` 포함 오류 문서는 staged sitemap에서 찾지 못해 실제 해당 URL 응답은
  미검증이다. 인코딩 경계 회귀 테스트와 운영 표본의 실제 HTTP 검증을 구분한다.
- 홈 responseStart 359ms라는 Aside 단일 관찰은 cold-cache/p95 개선 증거가 아니다.
  responseEnd가 미기록돼 전체 완료 시간으로 보고하지 않는다.

상세 보고서는 로컬 `.local/seo-release-20261021/`에 보관한다:

- `staged-complete-browser/publisher-page-qa-LV0jDW/report.json`
- `production-browser/publisher-page-qa-2pGeZs/report.json`
- `promotion-result.json`, `runtime-log-summary.json`, `upload-safety.json`

운영 DB 마이그레이션·콘텐츠 일괄 교정·사람 검수 자동 승인·AdSense 재심사 제출은
수행하지 않았다. 새 Google Rich Results Test URL 검사를 이번 릴리스에서 다시 실행하지
않았으며, 앞선 코드 모드 결과와 이번 운영 화면/JSON-LD 검증은 구분한다.

## 검증·롤백 계약

- 도메인 연결 전후 홈·상세·탐색·소개·가이드, robots·sitemap·llms와 응답 release 식별자를 확인한다.
- 화면/스키마의 제목·설명을 대조한다. 미검증·비공개 영상은 `VideoObject`에 포함하지 않는다.
- 실제 공개 제작 영상이 없으면 양성 재생 검증은 미완료로 남긴다.
- 모바일·키보드·모션 감소 검사에서 광고 요청/비읽기 요청은 전송 전에 차단한다.
- 문제가 있으면 기존 READY 배포 `dpl_6VNcGNmQ5Xt8aFXossTYPX6arxhg`를 승격해 웹만 복구한다.
  공유 환경변수·DB·사용자 파일을 되돌리거나 삭제하지 않는다.
- Search Console 재크롤, Ahrefs 점수 개선, AI 인용 증가, AdSense 자격은 이 웹 배포와 별개다.
