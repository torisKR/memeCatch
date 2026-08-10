# Loop 127 acceptance — LOC-023 zh Route-Unlock Operator Batch Lane

## 목표

zh Plus 번역 수요와 글로벌 route-unlock 후보를 하나의 운영 배치로 연결해, 운영자가
`Plus priority → GPT-5.6 Sol high preview → machine 초안 저장 → 다음 후보` 흐름을
안전하게 반복할 수 있게 한다.

## 수용 조건

- [x] zh의 `translationStatus === null` Plus 요청 밈이 일반 누락 원문보다 먼저 온다.
- [x] Plus 요청이 없으면 `routeUnlockCandidate` 우선, `updatedAt desc`·`memeId asc` 순서를 유지한다.
- [x] fixed batch limit과 `focusMemeId` 첫 행 예약을 보존한다.
- [x] GPT preview는 운영자가 선택한 행에만 실행되고 source revision mismatch는 차단된다.
- [x] GPT 계약은 `gpt-5.6-sol` + `high`이며, 실패 시 fail-closed 한다.
- [x] preview는 자동 저장되지 않고, 저장은 기존 machine 초안 CAS 경로만 사용한다.
- [x] 저장 성공 뒤 zh lane은 preview를 닫고 다음 후보를 선택하지만 GPT를 자동 실행하지 않는다.
- [x] Plus priority RPC unavailable은 empty와 별도 오류로 보인다.
- [x] 새 DB/API/RPC/schema/migration/자동 번역/자동 발행을 추가하지 않는다.

## 범위 밖

실제 operator 로그인/OTP, production Supabase/RLS write, live translation publication, payment/receipt,
production deploy는 실행하지 않았다. 현재 글로벌 checker artifact 448/1,520과 missing 1,072는
공급 완료 증거가 아니다.

## 관련 결정

- `docs/renewal/BACKLOG.md` — LOC-023
- `docs/renewal/DECISIONS.md` — D-073
- `docs/renewal/LOOP_STATE.md` — 루프 127
