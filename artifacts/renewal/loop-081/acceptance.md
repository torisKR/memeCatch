# Loop 081 acceptance

## Vertical

Plus Action Inbox를 `발견 → 활용 → 완료 → 재방문` 흐름으로 확장한다.

## Acceptance

- 활성 Plus 사용자만 활용 완료 RPC와 API에 접근할 수 있다.
- 같은 사용자·밈·KST 날짜의 완료는 한 번만 기록된다.
- Action Inbox는 오늘 완료한 밈을 다시 추천하지 않는다.
- 카드에서 검수된 요약과 상세 링크를 복사하거나 공유할 수 있다.
- 완료 후 오늘 완료 수와 현재 연속 활용 일수가 갱신된다.
- 기존 reviewed/current 콘텐츠와 locale-safe 링크 게이트를 유지한다.
- 외부 SNS 게시를 완료한 것으로 표현하지 않는다.
- migration은 파일로만 작성하고 이번 루프에서 적용하지 않는다.
- AI 호출, cron, 자동 게시, 운영 데이터 쓰기는 추가하지 않는다.
