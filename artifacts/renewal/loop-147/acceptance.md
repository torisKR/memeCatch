# Loop 147 Acceptance — PLUS-060 Global Daily → One-Cut Activation

## 사용자 결과

Premium Global Daily를 완료하거나 완료 상태로 다시 열면, 오늘의 실제 검수 문항 중 실행 가능한 밈에
`Prepare One-Cut` CTA가 나타난다. CTA는 같은 검수 콘텐츠 언어의 `/premium` Action Inbox로 돌아와 해당
밈을 첫 실행 카드로 보여주고, 기존 channel-aware Creator Pack과 명시적 receipt 흐름을 그대로 사용한다.

## 수용 기준

- Global Daily loader의 현재 12개 후보와 실제 3개 문항을 서버에서 다시 대조한다.
- `green`/`yellow` safety와 `rising`/`active` lifecycle인 후보만 One-Cut handoff를 만든다.
- handoff query의 `from`, `focus`, `locale`은 allowlist·현재 challenge·실제 content locale과 일치해야 한다.
- UI-only locale은 display 언어에만 사용하고, URL·Action Inbox·receipt content locale이 되지 않는다.
- 이미 오늘 완료한 action, completion unavailable, malformed question/candidate, unsupported locale, 다른 날짜나
  3문항 밖 ID, red/gray/cooling/archived 상태는 CTA·promotion·entry-source analytics를 닫는다.
- 같은 밈의 Scout/Signal/Fulfillment action은 중복하지 않고 하나의 reviewed action으로 합친다.
- Global Daily 경로는 translation review DTO에 없는 `usage_examples`를 만들거나 전달하지 않는다.
- 기존 Use Kit, standalone `/daily`, Daily Signal, Scout, channel-aware Creator Pack, explicit receipt, privacy
  safe analytics와 no-auto-posting을 유지한다.
- 새 DB/API/RPC/schema/migration/write/payment/AI/publication/deploy는 추가하지 않는다.

## 범위 밖

인증된 Plus entitlement/RLS, 실제 completion·receipt 저장, 결제/webhook activation, 번역 공급·publication,
외부 플랫폼 게시 성공, production deploy는 이번 루프의 수용 증거가 아니다.
