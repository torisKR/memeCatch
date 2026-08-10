# Loop 115 acceptance — LOC-021

## 선택한 수직

글로벌 검색에서 한국어 결과는 있지만 요청 locale의 reviewed/current 공개 번역이 없을 때,
사용자가 원문 Explore로 이동하는 것뿐 아니라 첫 원문 상세의 기존 글로벌 번역 옵션까지
바로 확인할 수 있게 한다. 이 handoff는 번역이 준비됐다고 주장하지 않으며, 기존 상세의
signed-out/free/Plus/request-status gate를 그대로 만난다.

## 완료 조건

1. query 결과가 1건 이상이고 localized lookup이 성공한 `coverage-empty` 상태에서만 기존
   Korean original Explore CTA와 두 번째 번역 옵션 CTA를 표시한다.
2. 번역 옵션 CTA는 첫 한국어 결과의 canonical `memePathFrom(short_id, slug)`에 정확히
   `#global-translation-title`을 붙여 연결한다. 가짜 localized route를 만들지 않는다.
3. CTA 문구는 `en`·`ja`·`zh`·`zh-tw`에서 locale copy를 사용하며, 번역 준비 완료·자동 발행·Plus
   entitlement를 암시하지 않는다.
4. localized result가 있거나 lookup이 unavailable이거나 query 결과가 없으면 두 recovery
   CTA 모두 표시하지 않는다. 기존 Korean original 카드 label/link와 submit 흐름은 유지한다.
5. 목적지의 기존 `TranslationPriorityButton`·save-required·free pricing·signed-out·request
   status·`#global-translation-title` gate를 변경하지 않는다.
6. 새 DB/API/RPC/schema/persistence/translation content/OpenAI 호출/analytics event/payment
   logic/production write/deploy를 추가하지 않는다.
7. focused/full tests, typecheck, lint, build, diff check 및 local production browser에서
   coverage-empty/active/no-result 및 실제 anchor 이동을 확인한다.

## 운영 경계

이번 루프는 글로벌 검색에서 기존 한국어 상세·번역 요청 표면으로 연결하는 local presentation-only
handoff다. 실제 Plus 인증·RLS/RPC, 사람 번역 검수/publication, 결제, OpenAI live call,
Supabase write, production deploy는 수행하지 않는다. 글로벌 reviewed 공급 **448/1,520**은
기존 LOC-007/LOC-010 gate로 남는다.
