# Loop 064 acceptance

## Target

`PLUS-004` — Plus 사용자가 저장 밈과 관심사 후보에서 최근 7일의 실제 변화를 최대 3개로 확인한다.

## Acceptance contract

- KST 기준 7일 창을 사용하고, 후보마다 최소 두 날짜의 `meme_trend_metrics`가 필요하다.
- `green`이며 `rising` 또는 `active`인 후보의 양수 trend delta만 포함한다.
- Saved Reuse Radar에 이미 표시된 밈과 최근 7일 `trend_alerts` 밈은 제외한다.
- 결과는 최대 3개이며, 후보가 없거나 history가 부족하면 generic 인기 밈으로 채우지 않는다.
- owner-scoped saved/interests 입력은 서버에서만 조합하고, 새 DB write/schema/RPC/cron/email은 없다.
- 모든 지원 locale은 locale-safe detail route와 Trend Panel anchor로 이동한다.

## Release boundary

로컬 코드·테스트·build·HTTP QA는 완료했지만 production deploy와 SUB-001 migration/RLS/cron은 별도
운영 HUMAN_GATE로 남긴다.
