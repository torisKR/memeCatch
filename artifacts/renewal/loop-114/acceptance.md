# Loop 114 acceptance — LOC-020

## 선택한 수직

글로벌 locale 검색에서 검색 결과는 있지만 해당 언어의 공개 가능한 reviewed/current 번역이 하나도
없을 때, 한국어 원문 탐색으로 복구할 수 있는 명시적 선택형 CTA를 제공한다.

## 완료 조건

1. `en`·`ja`·`zh`·`zh-tw`에서 `query`와 한국어 검색 결과가 있고 localized result가 0건인
   `coverage-empty` 상태에만 Korean original Explore CTA를 표시한다.
2. CTA는 정확히 `/explore`를 가리키며, 기존 검색 결과의 `Korean original` 표기와 원문 링크를
   유지한다. 번역되지 않은 원문을 현지화 결과로 가장하지 않는다.
3. localized result가 하나라도 있거나, 검색 결과가 없거나, localized lookup이 unavailable인
   경우 CTA를 표시하지 않는다.
4. query search, reviewed/current/depth gate, canonical·robots·hreflang, analytics 및 submit
   흐름을 변경하지 않는다.
5. 새 DB/API/RPC/schema/persistence/translation content/OpenAI 호출/production write/deploy를
   추가하지 않는다.
6. 네 locale의 coverage-empty/active/unavailable/zero-result 회귀와 전체 테스트·타입·lint·build·
   diff check 및 local browser smoke를 통과한다.

## 운영 경계

이번 루프는 검색 결과 복구를 위한 local presentation-only 변경이다. 번역 생성·사람 검수·publication과
글로벌 reviewed 공급 **448/1,520** 보강은 기존 LOC-007/LOC-010 운영 gate로 남긴다.
