# Loop 113 acceptance — PLUS-037

## 선택한 수직

결제 확인 완료를 활성 구독자의 첫 One-Cut 행동으로 연결한다.

## 완료 조건

1. `?checkout=return`에서 서버 entitlement가 `isPremium: true`로 확인된 경우에만 결제 확인 문구와 첫 One-Cut 시작 CTA가 함께 보인다.
2. CTA는 기존 `/premium#plus-global-action-inbox-title` anchor를 가리켜, 새 사용자에게 별도 탐색 없이 현재 Plus의 첫 가치 행동을 연다.
3. entitlement 확인 전, signed-out/일반 `/premium` 진입, polling 오류 및 60초 timeout에는 Plus 행동 CTA를 노출하지 않는다.
4. 기존 서버 entitlement 판정, polling 횟수/간격, `router.refresh()`와 결제 provider 흐름은 변경하지 않는다.
5. `ko`·`en`·`ja`·`zh`·`zh-tw` copy가 제공되고 CTA는 권한을 추측하거나 새로운 private payload를 만들지 않는다.
6. 새 DB/API/RPC/schema/persistence/payment 상태 판정/analytics event/OpenAI 호출/production write/deploy를 추가하지 않는다.
7. component regression, full suite, tsc, lint, build, diff check와 local browser smoke를 통과한다.

## 운영 경계

이번 루프는 결제 복귀 UI의 local handoff만 보강한다. 실제 결제·웹훅·authenticated Plus/RLS와 production 배포는 기존 ACT-001 운영 gate로 남긴다.
