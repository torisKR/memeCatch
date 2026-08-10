# Loop 145 Acceptance — ACT-001 Negative Receipt Integrity

## 목표

Premium One-Cut의 Creator Pack 활용 완료 기록에서 같은 날 같은 밈의 재시도는 동일한
의미일 때만 멱등 성공하고, 채널·콘텐츠 언어·산출물·결과 URL·메모가 달라지면 기존
owner receipt를 덮어쓰거나 성공으로 오인하지 않는다.

## 완료 조건

- [x] 동일한 여섯 의미 필드의 retry는 기존 receipt ID와 `already_recorded=true`를 유지한다.
- [x] 여섯 필드 중 하나라도 달라지면 RPC가 `receipt_conflict`로 fail-closed한다.
- [x] API는 `receipt_conflict`를 HTTP 409로 변환하고 UI는 5개 콘텐츠 언어의 명시적 안내를 표시한다.
- [x] local ACT-001 runner가 `creator_pack` receipt를 사용하고 실제 `p_channel` 변경 retry, free/canceled/cross-owner 경계, 원본 필드 보존, receipt/completion cleanup 검증을 갖는다.
- [x] direct receipt table write 권한과 owner-scoped read 경계는 유지된다.
- [ ] 로컬 Supabase RPC 실행 자체는 이번 환경의 CLI crash와 `LOCAL_SUPABASE_*` 미설정으로 확인하지 못했다. 이는 production activation 완료로 승격하지 않는다.

## 범위 밖

실제 결제·Unifi webhook·preview activation·production write/deploy·번역 publication·외부 게시 성공은
변경하거나 주장하지 않는다.
