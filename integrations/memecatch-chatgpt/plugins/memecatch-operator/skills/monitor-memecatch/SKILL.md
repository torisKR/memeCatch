---
name: monitor-memecatch
description: Use the connected MemeCatch operator app to monitor the approved repository events and maintain the existing operating Page.
---

# 밈캐치 운영 연결

이미 OAuth 연결된 밈캐치 운영 앱을 사용한다. 이 패키지는 인증 정보나 별도 MCP 서버를 포함하지 않는다.

사용자가 이벤트 연결을 요청하면 해당 앱에서 실제로 제공되는 네이티브 이벤트 구독 기능과 반환된 스키마를 확인한다. 승인된 범위는 repository `torisKR/memeCatch`의 `memecatch.ci_failed`, `memecatch.main_updated`, `memecatch.issue_changed`이다. 콜백 URL, signing secret, trigger 인자를 만들거나 추측하지 않는다. 카탈로그에 이벤트가 표시되는 것, 구독 저장, 콜백 검증, 이벤트 수신, AI 실행을 각각 구분해 확인한다.

연결된 운영 Page는 `page_c86babf98ec88191925bbd838c767f48`이다. 변경 전에 Pages 도구로 현재 원본과 native Agent Instructions를 읽고, `get_page_auto_update`와 `list_page_automations`로 현재 controller를 확인한다. 기존 controller와 매시간 일정은 보존하고, 같은 목적의 자동화를 중복 생성하지 않는다. 실제 이벤트 스키마가 없는 경우 다른 이벤트나 시간 기반 예약으로 바꿔서 완료라고 표시하지 않는다.

운영 Page의 검증된 상태만 갱신한다. 코드 수정, 배포, 외부 메시지 전송, 권한 확대는 하지 않는다. 비밀값과 개인정보는 출력하지 않는다. 수동 확인을 Pages 자율 실행으로 표시하거나 자동 갱신 완료 문장을 수동으로 추가하지 않는다. 상태가 그대로면 알리지 않고, 의미 있는 변경·실패·완료·필요한 사용자 행동만 알린다.
