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
- QA 도구 Node 테스트: 29개 통과.
- `git diff --cached --check`: 통과.
- 스테이징된 diff Gitleaks 검사: 비밀정보 발견 없음.

복구된 예전 릴리스 전용 테스트 4개는 당시의 premium 섹션·직접 import 구조를 고정하는
일회성 검사여서 새 소스에 추가하지 않았다. 실제 상세 페이지/JSON-LD/공개 영상 gate 테스트로
현재 계약을 검증한다. 기존 홈의 중복 검색 제거와 동적 홈 메타데이터에 맞춰 회귀 테스트를
정합화했으며, 별도 미완료 홈 리디자인은 포함하지 않았다.

로컬 빌드는 공개 DB 자격만 전달했다. 서버 자격은 전달하지 않았으므로 공개 미디어 원장과
홈 추천 조회 경고가 남는다. 다른 정적 경로의 기존 metadataBase fallback 경고도 남는다.
빌드 성공을 운영 원장/실제 공개 영상 재생 검증 성공으로 해석하지 않는다.

## 배포 상태

운영 staged 배포·검증·승격은 아직 진행 전이다. 실제 배포 ID와 운영 도메인 확인 결과는
완료 후 이 절에 추가한다. 검증 실패 시 기존 운영 도메인 연결을 유지한다.

## 검증·롤백 계약

- 도메인 연결 전후 홈·상세·탐색·소개·가이드, robots·sitemap·llms와 응답 release 식별자를 확인한다.
- 화면/스키마의 제목·설명을 대조한다. 미검증·비공개 영상은 `VideoObject`에 포함하지 않는다.
- 실제 공개 제작 영상이 없으면 양성 재생 검증은 미완료로 남긴다.
- 모바일·키보드·모션 감소 검사에서 광고 요청/비읽기 요청은 전송 전에 차단한다.
- 문제가 있으면 기존 READY 배포 `dpl_6VNcGNmQ5Xt8aFXossTYPX6arxhg`를 승격해 웹만 복구한다.
  공유 환경변수·DB·사용자 파일을 되돌리거나 삭제하지 않는다.
- Search Console 재크롤, Ahrefs 점수 개선, AI 인용 증가, AdSense 자격은 이 웹 배포와 별개다.
