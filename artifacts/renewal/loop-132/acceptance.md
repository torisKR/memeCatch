# Loop 132 Acceptance — GLO-007

## 목표

현재 공개 Korean meme `fmbbud58`(트랄랄레로 트랄랄라)에 대해 기존 source snapshot을 잠그고,
`en`·`ja`·`zh`·`zh-tw` 4개 locale의 machine translation draft를 사람이 검수할 수 있는 단일 pack으로
준비한다. 이 결과는 글로벌 공개 공급을 위한 입력 증적이지, reviewed/public translation이 아니다.

## 완료 조건

- worklist에 속한 동일 `meme_id`·`short_id`에 대해 4개 locale이 정확히 하나씩 존재한다.
- 네 row가 동일한 source snapshot과 `updated_at`을 사용한다.
- title·summary·description·origin·usage_note·caution·aliases·usage_examples의 exact schema와
  locale 언어 규칙을 통과한다.
- source가 비어 있는 `usage_examples`는 새 예문을 만들지 않고 빈 배열로 유지한다.
- 기존 artifact와 중복되지 않고, `--require-complete` intake와 machine-only SQL checker를 통과한다.
- SQL은 source revision/CAS와 `status=machine`을 유지하며, reviewed 승격·production write·publication·deploy를
  수행하지 않는다.

## 범위 밖

실제 Supabase 적용, operator `gpt-5.6-sol` high 검수 승인, reviewed/current 공개, `/en` production deploy와
Plus authenticated fulfillment E2E는 별도 human gate다.
