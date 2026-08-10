# Loop 128 acceptance — PLUS-047

## 목표

Plus 사용 기록에서 receipt가 실제로 사용한 locale의 공개 상세 페이지를 다시 열 수 있게 한다.
단, 공개 페이지와 같은 reviewed/current·필수 번역 필드·원문 충실도 gate를 통과한 경우에만
localized link를 제공한다.

## 수용 기준

- 최근 30일·최대 50건 owner-scoped receipt history의 locale을 링크 판정에 사용한다.
- `ko`는 기존 Korean canonical path를 유지한다.
- exact locale의 reviewed/current 번역이 공개 indexability gate와 비어 있지 않은 `reviewed_at`/`reviewed_by` 감사 gate를 통과하면 localized detail path를 사용한다.
- stale, missing, incomplete 또는 얇은 번역은 Korean fallback으로 표시한다.
- nested translation data를 확인할 수 없는 row는 `unavailable`로 닫고 fake link를 만들지 않는다.
- `result_url`, `private_note`, receipt/private 식별 정보는 select·parser·UI에 노출하지 않는다.
- 기존 active Plus entitlement/RLS, receipt write, payment, human review/publication 경계를 변경하지 않는다.

## 범위 밖

실제 Plus 로그인/영수증 생성, production RLS 데이터, 번역 공급량 확대, human publication,
사이트맵 공개 범위 변경, production deploy는 이 루프에서 수행하지 않는다.
