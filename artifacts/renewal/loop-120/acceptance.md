# Loop 120 acceptance

## Selected vertical

`PLUS-042` — 다중 Creator Pack의 밈별 Scenario 선택

Loop 119는 One-Cut 첫 밈 하나에만 검수된 `usage_examples` 선택을 적용했다. 현재
다중 Creator Pack은 단일 `usageExampleIndex`를 모든 item에 재사용하므로, 각 밈의
검수 예문이 해당 밈의 결과에 귀속되지 않는다.

## Acceptance criteria

1. `/premium`의 One-Cut은 한 장을 기본으로 유지하고, 후보가 2개 이상일 때만 명시적인 opt-in으로
   추가 검수 카드를 Creator Pack에 포함할 수 있다.
2. 포함된 각 item이 자신이 가진 검수된 usage example을 독립적으로 선택할 수 있다.
3. 선택 결과는 같은 item의 share text/preview에만 반영되고, 다른 item의 문구를 바꾸지 않는다.
4. usage example이 없는 item은 새 문장을 생성하지 않고 명시적인 no-example 상태를 보인다.
5. 기존 One-Cut 선택, localized reviewed/current/no-fallback gate, channel-to-format mapping,
   export/share/receipt fail-closed 동작은 유지한다.
6. 선택·준비 과정은 기존 read DTO와 export를 재사용하고 새 DB/API/RPC/schema/migration/write,
   analytics, OpenAI 호출을 추가하지 않는다.
7. `ko`, `en`, `ja`, `zh`, `zh-tw`의 기존 copy/route/privacy/entitlement 경계를 유지하고,
   authenticated Plus/live translation supply는 이 로컬 루프의 성공으로 주장하지 않는다.
