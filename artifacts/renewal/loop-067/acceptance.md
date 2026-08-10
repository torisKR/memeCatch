# Loop 067 acceptance

## User outcome

Plus 사용자가 자기 저장 밈의 현재 locale 번역을 우선 검수 요청하고, 운영자는 수요순 큐에서
검수를 시작하며, 최신 reviewed 번역 승인 뒤 요청자는 저장 밈 문맥 알림으로 완료를 확인한다.

## Acceptance contract

- 현재 최신 reviewed 번역은 새 요청을 만들지 않는다.
- 요청 RPC는 로그인·활성 Plus·자기 저장 밈·공개 밈·en/ja/zh/zh-tw locale을 재검증한다.
- 같은 사용자·밈·locale 요청은 idempotent하고, pending 요청은 사용자당 20건으로 제한한다.
- 관리자 큐는 밈·locale별 요청 수를 집계해 수요순으로 정렬하고, operator만 claim할 수 있다.
- 최신 원문과 일치하는 reviewed 번역만 요청을 완료하며, 활성 Plus 요청자에게 Loop 066의
  `plus_saved_context_alerts`를 `(user_id, event_id)` 중복 없이 생성한다.

## Safety boundary

- 요청 테이블의 직접 insert는 열지 않는다. self read와 operator read/update만 허용한다.
- Loop 065 GPT 결과는 자동 저장·자동 게시하지 않으며 기존 운영자 승인·CAS를 유지한다.
- 번역 완료 알림은 공개 변경 이벤트만 참조하고 private 저장 메타데이터를 노출하지 않는다.

## External gates

- `20260809120000_plus_translation_priority_requests.sql`의 실제 Supabase migration 적용은
  승인되지 않았고 수행하지 않았다.
- 실제 RLS/RPC/trigger, Plus 인증 세션, 완료 알림 fan-out, production deploy/push/merge는 미검증이다.
- 이 산출물은 로컬 코드·SQL source contract 완료를 기록하며 production 완료를 의미하지 않는다.
