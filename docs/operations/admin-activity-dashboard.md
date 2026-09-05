# 관리자 사용자 활동 대시보드

## 사용

관리자 메뉴 → **사용자 활동** (`/admin/activity`). 기존 operator 계정만 접근할 수 있다.

- 기본 기간은 오늘을 포함한 최근 7일, 조회 가능 범위는 최대 31일이다.
- 시작일·종료일은 한국 시간(Asia/Seoul) 기준이며 종료일 전체를 포함한다.
- 일별 날짜를 누르면 해당 날짜의 00~23시 집계로 바뀐다.
- `현재 Plus 구독자만`을 선택하면 기간 내 활동이 없는 구독자도 목록에 나온다.
- 사용자 행의 `조회 내역`으로 계정을 선택한다. `계정 관리`는 기존 관리 화면으로 이동한다.
- 사용자는 25명, 조회 콘텐츠는 50건씩 나누며 필터와 페이지가 URL에 저장된다.
- 새로고침이나 `조회하기`로 최신 데이터를 읽는다. 실시간 접속자 수를 표시하는 기능은 아니다.

## 지표 정의

| 지표 | 기준 |
| --- | --- |
| 기록된 밈 조회 | `growth_events`의 `source=client`, `event_name=meme_view` 이벤트 수 |
| 활성 로그인 사용자 | 기간 내 client 이벤트가 있는 `user_id`의 중복 제거 계정 수 |
| 익명 방문 세션 | `user_id IS NULL`인 client 이벤트의 `session_id` 중복 제거 수 |
| 현재 Plus 구독자 | `status=active`이고 `current_period_end > now()`인 계정의 중복 제거 수 |

현재 Plus 요약 숫자는 전체 계정의 현재 상태이며 날짜·사용자 필터와 무관하다. 나머지 시간 집계와 조회 기록은 선택 조건을 따른다. 기간별 활성 사용자 수를 더한 값은 전체 기간의 고유 사용자 수와 다를 수 있다.

기존 수집 경로의 분 단위 중복 제거, 추적 차단, 전송 실패의 영향을 받는다. 익명 세션은 사람 수가 아니며 로그인 계정과 합산하거나 역으로 연결하지 않는다. 삭제된 계정의 이전 이벤트는 익명으로 남을 수 있다. 구독 상태는 과거 결제 매출이나 실제 결제 성공의 증거가 아니다.

## 개인정보와 접근 제어

- 새 추적 코드·외부 분석 서비스·의존성·테이블을 추가하지 않는다.
- 페이지에서 사용자와 operator 여부를 확인한 뒤 세션 클라이언트로 RPC를 호출한다.
- DB에서도 operator를 확인한다. 비로그인·일반 회원은 조회할 수 없다.
- 공개 RPC는 `SECURITY INVOKER`이며 실제 집계는 비노출 `private` 스키마의 함수에서 수행한다. private 함수의 직접 호출에도 operator 검사가 적용되며 원장 테이블의 SELECT 권한은 공개하지 않는다.
- 반환 DTO는 닉네임, 계정 ID, 콘텐츠 제목/링크, 조회 시각, 현재 구독 상태와 집계로 제한한다. 이메일·IP·검색어·세션 ID·이벤트 metadata/path는 반환하지 않는다.
- `/admin/activity`는 `(admin)` 별도 root layout을 사용한다. 공통 광고·GA·AttributionTracker를 포함하지 않는다. root layout 사이 이동은 문서 전체 탐색으로 이뤄져 기존 마케팅 스크립트가 활동 화면에 남지 않는다.
- `noindex,nofollow` 및 `no-referrer` 메타데이터를 적용한다. 인증·인가를 대체하는 설정은 아니다.
- 권한이 없는 사용자를 공개 홈으로 돌려보낼 때 관리자 조회 조건을 URL에서 제거한다.
- 구독 데이터에는 쓰기를 하지 않으며 결제·웹훅·환불·entitlement 로직을 변경하지 않는다.
- RPC 오류나 잘못된 입력은 안내를 표시한다. 실패를 0명/0건으로 표시하지 않는다.

## 반영과 검증

먼저 `20260905034152_admin_activity_dashboard.sql`을 대상 DB에 적용하고 앱을 배포한다. 같은 migration에서 원장 시간 범위 집계용 부분 인덱스를 추가하므로 큰 운영 원장에서는 실행 시간과 잠금을 확인한다. 기존 운영 배포 게이트와 checkout 비활성 정책을 유지한다.

```sh
pnpm exec vitest run components/admin/activity-dashboard.test.tsx
supabase test db /absolute/repo/supabase/tests/admin_activity_dashboard.test.sql --workdir /absolute/repo
pnpm exec tsc --noEmit
pnpm exec eslint
pnpm exec vitest run
pnpm build
git diff --check
```

브라우저 인수 항목: 비로그인 리다이렉트, 관리자 로그인, 일별 날짜 선택, 구독자 필터(활동 0 포함), 사용자별 콘텐츠 조회, 두 목록 페이지 이동, 새로고침, 빈 기간, 잘못된 ID, 모바일 가로 넘침, 외부 script/iframe 부재. 테스트 계정과 결제 행은 실제 거래가 아닌 격리된 합성 데이터만 사용한다.

롤백은 앱 이전 버전으로 되돌리면 된다. additive DB 객체는 유지할 수 있으며 원장·결제 감사 데이터를 삭제하지 않는다.

## 2026-09-05 검증 기록

- 전체 Vitest: 290개 파일, 1,977개 테스트 통과. 대시보드 11개 및 proxy 회귀 테스트 포함.
- SQL: 로컬 Supabase 57/57, Preview `hsuqapozawtxhycvcgjm` 57/57 통과. Preview 테스트 후 합성 계정 0개, 기존 client 이벤트 1개 유지 확인.
- TypeScript, production build, `git diff --check` 통과. 전체 lint 오류 0건, 기존 경고 7건 유지. 빌드의 기존 `metadataBase` 경고는 별도다.
- 실제 브라우저: 로컬 Supabase의 일회용 운영자로 로그인하여 조회 57건, 활성 계정 2명, 익명 세션 1개, 중복 제거된 현재 구독자 28명 확인. 이는 결제가 아닌 테스트 fixture의 기대값이다.
- 날짜 선택 후 00시 55회 및 다른 시간 분리, 구독자 목록 25+3명, 활동 없는 구독자, 선택 계정의 조회 50+5건, 새로고침 유지, 빈 기간과 입력 오류를 확인했다.
- 390px 모바일에서 document 너비 390px, 표 영역만 내부 스크롤. 관리자 문서 외부 script/iframe 0개, 브라우저 콘솔 오류 0건.
- Supabase advisor의 대시보드 관련 항목 0건. 기존 `meme_reaction_counts`, `generation_vote_stats` 뷰의 `security_definer_view` 항목은 이번 변경이 만든 것이 아니며 별도 검토 대상으로 유지한다. 이 기록은 저장소 전체 보안 완료나 운영 배포 완료를 뜻하지 않는다.
- Preview migration ledger는 최종 저장소 버전 `20260905034152`로 정규화했다. 운영 DB에는 적용하지 않았다.
