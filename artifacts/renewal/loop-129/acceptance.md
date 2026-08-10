# Loop 129 acceptance — PLUS-048

## 목표

최근 30일 동안 사용자가 `hit`로 평가한 결과를 현재도 공개 가능한 상태인지 서버에서 다시
확인한 뒤, 같은 언어와 이전 채널을 유지한 One-Cut Action Inbox로 다시 실행한다.

## 수용 기준

- [x] Outcome History의 eligible `hit` 행에만 `replay` CTA를 표시한다.
- [x] replay query는 public short id, receipt locale, `from=outcome_history`가 모두 단일·허용값일 때만 인정한다.
- [x] 인증 만료 시 proxy가 검증된 replay query를 login `next`에 보존하고, 중복·혼합·외부 값은 `/premium`으로 축약한다.
- [x] 서버가 owner-scoped receipt, `approved/limited`, indexable source, `green/yellow`, `rising/active`, exact-locale reviewed/current gate를 다시 확인한다.
- [x] UI locale와 receipt locale이 달라도 replay item을 Action Inbox 첫 카드로 유지한다.
- [x] 이전 receipt channel을 Creator Pack 기본 채널로 미리 채우고 `entry_source=outcome_history`를 기존 One-Cut funnel에 전달한다.
- [x] 오늘 완료 목록이 있으면 replay를 제외하고, 완료 상태를 불러오지 못하면 replay를 fail-closed로 제외한다.
- [x] stale·missing·unavailable·비한국어 Korean fallback·non-hit·위험/archived 상태에는 replay CTA/item을 만들지 않는다.
- [x] `result_url`, `private_note`, receipt id는 history DTO·UI·analytics에 노출하지 않는다.
- [x] 새 DB/API/RPC/schema/migration/receipt write/AI/publication 자동화를 추가하지 않는다.

## 범위 밖

실제 authenticated Plus receipt/RLS 데이터, production 번역 발행, operator 검수, 결제, 외부 게시,
production deploy는 이 루프에서 수행하지 않는다.
