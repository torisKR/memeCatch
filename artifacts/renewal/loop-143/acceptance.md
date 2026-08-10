# Loop 143 acceptance — PLUS-058 Seven-Day Winning Replay

## Target

Active Plus 사용자가 최근 7일 안에 `hit`으로 자기 평가한 활용을 Premium 첫 화면에서 다시 실행할 수
있게 한다. 이 기능은 “검증된 외부 성과”가 아니라 사용자가 남긴 평가를 근거로 표시한다.

## Acceptance

- `ready`인 7일 Outcome Summary와 30일 owner-scoped History가 모두 있을 때만 후보를 만든다.
- 후보는 Summary의 `fromDate`~`toDate` 안에 있고, `performanceRating=hit`이며, 기존 localized/current
  replay eligibility와 안전한 replay path를 가진 최신 1건으로 제한한다.
- 오늘 completion이 하나라도 있거나 completion read가 `unavailable`이면 promotion을 fail-closed한다.
- Snapshot은 제목·사용일·채널·콘텐츠 언어·산출물만 표시하고 receipt ID, private note, performance note,
  result URL을 전달하거나 렌더링하지 않는다.
- CTA는 기존 `replay`, `replay_locale`, `from=outcome_history` 경로만 사용하며 클릭 시 새 write/API/외부
  게시를 발생시키지 않는다.
- Replay 요청이 실제 Action Inbox에 활성화되면 Snapshot promotion을 숨기고, History는 동일한
  `shortId + locale` 항목을 “현재 실행 중”으로 표시해 중복 CTA를 만들지 않는다.
- UI-only 로케일에서도 UI copy와 receipt 콘텐츠 로케일을 섞지 않는다.

## Scope boundary

이번 루프는 기존 receipt/history/completion/read-only replay 경로만 연결했다. 새 DB/API/RPC/schema/
migration, 결제, 실제 외부 게시 확인, 번역 생성·발행, production deploy는 수행하지 않았다.
