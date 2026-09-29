# 관리자 사용자 활동 대시보드 검증

- 기준 커밋: `7a54da6e03732bfc2bd2e004205075128782cdd0`
- 작업 브랜치: `codex/admin-activity-dashboard`
- 작업 폴더: `/tmp/memecatch-main-release-20260905`
- 사용자 경로: `/admin/activity`
- 원래 `/Users/toris/projects/memecatch`의 dirty 변경은 보존했으며 RC에 포함하지 않았다.

## 완료

1. 기간별 사용자·익명 세션·밈 조회 및 현재 구독자 집계, 사용자별 조회 콘텐츠, 일별/시간별 집계, 조건/페이지 URL 유지 구현.
2. operator 이중 검증, 비노출 private DB 집계, 공개 invoker wrapper, 최소 DTO 적용. 결제·구독 쓰기 로직 변경 없음.
3. 광고·외부 분석이 없는 관리자 root document 및 no-referrer 적용. 비운영자 홈 리다이렉트에 관리자 query를 남기지 않도록 수정.
4. 로컬/Preview DB 검증 및 실제 브라우저 QA 완료.

## 검증 증거

| 검증 | 결과 |
| --- | --- |
| 전체 Vitest | 290개 파일 / 1,977개 테스트 PASS |
| focused 대시보드 + proxy | 62개 테스트 PASS |
| 로컬 PostgreSQL pgTAP | 57/57 PASS |
| Preview PostgreSQL pgTAP | 57/57 PASS, executed=expected=57, failed=0 |
| TypeScript | `pnpm exec tsc --noEmit` PASS |
| 전체 lint | 오류 0, 기존 경고 7 |
| production build | PASS, `/admin/activity` 동적 route 생성 |
| diff | `git diff --check` PASS |
| 모바일 | viewport 390px / document 390px, 표 내부 스크롤 |
| 관리자 외부 콘텐츠 | 외부 script 0, iframe 0, referrer=no-referrer |
| 브라우저 콘솔 | 최종 화면 오류 0 |

실제 브라우저는 로컬 Supabase의 일회용 운영자 계정으로 로그인했다. 합성 fixture의 조회 57건, 활성 계정 2명, 익명 세션 1개, 현재 구독자 28명을 확인했다. 날짜 클릭으로 KST 00시 55회 분리를 확인했고, 구독자 25+3명, 선택 계정의 조회 50+5건, 새로고침 상태 유지, 활동 없는 구독자, 빈 기간 및 잘못된 ID의 오류 안내를 확인했다. 마지막 private DB wrapper 변경 후에도 로그인과 선택 계정 55건 조회를 다시 확인했다.

로컬 QA 종료 후 계정/이벤트/구독 테스트 행은 각각 0개다. Preview pgTAP는 rollback 방식이며 종료 후 fixture 계정 0개 및 기존 client 이벤트 1개 유지 확인.

## Preview DB

- 프로젝트: `hsuqapozawtxhycvcgjm` (`memeCatch-preview`, ap-northeast-2)
- 최종 ledger: `20260905034152 / admin_activity_dashboard`
- 개발 중 생긴 두 중간 적용 이력은 공식 CLI repair로 canonical 버전에 정규화했다. 실제 스키마를 되돌리거나 원장 데이터를 삭제한 작업이 아니다.
- 보안 advisor: 대시보드 관련 항목 0개. 기존 `meme_reaction_counts` / `generation_vote_stats`의 security-definer-view 항목은 별도 검토 대상으로 남아 있다. 전체 저장소 보안 완료 주장 아님.

## Preview 앱 배포

- 배포 ID: `dpl_AKThyS9zwCgs49W95ZayLHGrg4eW`
- 주소: https://memecatch-maya69ept-ironjustlikethatgmailcoms-projects.vercel.app/admin/activity
- Vercel CLI 59.10.0, `--target=preview`, checkout과 Bedrock 생성 비활성.
- Preview 환경의 Supabase host는 `hsuqapozawtxhycvcgjm.supabase.co`로 확인했다. 설정 확인용 임시 파일은 삭제했다.
- Vercel 최종 상태: `READY`, target=`preview`.
- `/admin/activity` 비로그인 요청: HTTP 307 → `/login?next=%2Fadmin%2Factivity`.
- 응답 `x-memecatch-release-sha`: `7a54da6e03732bfc2bd2e004205075128782cdd0`, RC와 일치.
- 관리자 로그인 화면: HTTP 200.
- Preview 실제 운영자 계정의 브라우저 세션 검증은 하지 않았다. 인증된 화면 조작은 로컬 일회용 계정으로, Preview 권한·집계는 실제 Preview DB의 롤백형 pgTAP로 각각 검증했다.

구현·회귀 테스트·로컬 브라우저 QA·Preview DB 및 앱 배포는 완료했다. 운영 반영은 이 작업의 완료 주장에 포함하지 않는다.

## 제외 및 잔여 경계

- 운영 DB 및 운영 앱은 이번 변경을 반영하지 않았다. 기존 운영/ACT-001 게이트를 우회하지 않았다.
- 실제 결제·매출·실사용자의 완전한 행동 수집을 검증한 것이 아니다.
- 기존 build metadataBase 경고와 lint 경고는 수정 범위 밖이다.
- 가짜 tracking 또는 결제 mock을 운영 경로에 추가하지 않았다. 테스트는 합성 데이터로만 수행했다.
