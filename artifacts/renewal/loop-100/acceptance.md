# Loop 100 acceptance

## Selected vertical

`PLUS-029` — Plus `/premium`의 `오늘의 1컷`: 검수 완료 action 하나를 카드 preview와 명시적 활용 기록까지 닫는 첫 화면 흐름.

## Acceptance

- active Plus action surface는 eligible action 하나만 먼저 보여주고, aggregate snapshot은 그 뒤에 둔다.
- 기존 localized export로 준비한 PNG blob을 실제 이미지 preview와 캡션/상세 링크 텍스트로 확인할 수 있다.
- Web Share·clipboard·download fallback 뒤에도 자동 completion하지 않으며, 사용자가 명시적으로 활용 완료를 저장해야 다음 카드로 이동한다.
- one-cut receipt는 사용 채널과 산출물만 확인해 입력 부담을 줄이고, 기존 full inbox receipt의 URL·성과·개인 메모 필드는 유지한다.
- reviewed/current 번역이 있어도 원문 `isIndexableMeme` depth gate를 통과하지 못하면 `source_incomplete`로 표시하고 localized detail/action link를 만들지 않는다.
- free/signed-out, owner-scoped completion, no production write, no auto-publish, 기존 full inbox 기본 모드를 유지한다.

## Out of scope

신규 Supabase migration/RPC, production DB write, authenticated Plus/RLS E2E, 실제 receipt 저장, 번역 생성·OpenAI 호출,
machine→reviewed 승인, human publication, external post, deploy, push, merge.
