# Loop 063 acceptance

## Target

`PLUS-003` — Plus 사용자가 저장한 밈을 발견한 뒤, 안전한 다음 행동을 선택하고 현재 locale의
Meme Use Kit으로 바로 이동한다.

## Acceptance contract

- 기존 `buildSavedReuseRadar` 결과만 사용한다. 새 사실, AI 생성 의미, 새 안전 판정은 만들지 않는다.
- `readyNow`, `checkContext`, `archive`에서 최대 한 건씩만 선택해 최대 3개 행동을 만든다.
- 각 행동은 `/en`, `/ja`, `/zh`, `/zh-tw` 또는 기본 상세 route의 `#meme-use-kit-title`로 이동한다.
- 저장 밈이 없으면 빈 추천 대신 `/explore` CTA를 제공한다.
- private saved metadata와 production schema/billing/alert 데이터는 변경하지 않는다.

## Release boundary

로컬 코드와 검증은 완료했지만 production deploy와 SUB-001 migration/RLS/cron 적용은 별도 운영
HUMAN_GATE로 남긴다.
