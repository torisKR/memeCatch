# LOOP-083 Acceptance — Plus Creator Pack

이번 루프는 기존 Plus Action Inbox의 상위 행동을 바로 게시 준비물로 만드는 단일 수직이다.
새 추천 패널·DB 모델·자동 게시를 추가하지 않는다.

- Creator Pack은 active Plus의 기존 Action Inbox 내부에서만 제공한다.
- 기존 `translation_ready > saved_signal > new_reviewed`, 중복 제거, 완료 항목 제외, 최대 5개를 그대로 따른다.
- 각 카드의 caption/safety/detail link/PNG는 현재 웹 locale의 reviewed/current 공개 콘텐츠만 사용한다.
- 비한국어 번역이 missing/stale/incomplete이면 한국어 fallback하지 않는다.
- native multi-file share가 가능하면 PNG 묶음과 통합 caption을 한 번에 공유한다.
- native share가 불가능하면 통합 caption을 한 번 복사하고 PNG를 개별 다운로드한다.
- 카드 일부 실패는 성공 수와 실패 수를 분리하며 전체 실패를 완료로 표현하지 않는다.
- 기존 export GET의 Plus·공개 상태·locale freshness·private no-store 경계를 재사용한다.
- 새 migration/RPC/cron/DB mutation/외부 SNS POST는 추가하지 않는다.
