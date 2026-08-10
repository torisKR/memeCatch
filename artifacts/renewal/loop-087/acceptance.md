# Loop 087 acceptance

## 목표

Plus 구독자가 첫 화면에서 “오늘 무엇을 끝냈는가”를 확인할 수 있도록, 기존 검수 콘텐츠
Action Inbox와 Creator Pack을 하나의 오늘의 활용 결과 흐름으로 승격한다.

## 수용 조건

- active Plus 대시보드의 첫 업무 영역이 Action Inbox다. Daily Signal·Global Scout·개인
  localized feed는 근거와 추가 탐색 표면으로 뒤에 유지한다.
- 결과 상태는 `ready`·`prepared`·`complete`·`empty`·`unavailable`을 구분한다.
  `complete`는 초기 완료 수가 있거나 마지막 카드가 명시적으로 완료된 경우에만 표시한다.
- Creator Pack 생성·공유·다운로드에서는 completion API를 호출하지 않는다. 성공 카드만
  receipt에 남기고, 사용자가 확인 버튼을 누를 때만 기존 owner-scoped completion API를 호출한다.
- partial export/completion failure는 실패 항목과 재시도 경계를 유지한다. 자동 게시나 새로운
  사실 생성은 없다.
- 결과 copy는 `ko`·`en`·`ja`·`zh`·`zh-tw`에 제공되고 Traditional Chinese Action Inbox는
  전용 copy override를 사용한다.
- active Plus가 Global Meme Daily에 진입할 때 upgrade CTA가 아니라 첫 문제 시작 CTA를 보인다.
- 이번 루프는 새 migration/table/RPC/cron/DB write/AI 호출/외부 게시/production deploy를
  수행하지 않는다.

