# Loop 068 acceptance

## User outcome

활성 Plus 사용자가 직접 수신 동의를 켜고 언어를 선택하면, 저장 밈 급상승을 먼저 담은 짧은 Daily
Signal 이메일을 하루 한 번 받을 수 있다. 메일은 현재 검수된 콘텐츠와 안전 신호만 사용하며, 각
항목은 사용자의 언어 상세 페이지로 이동한다.

## Acceptance contract

- signed-out 사용자는 preference API와 cron을 사용할 수 없다.
- 수신 enable은 active Plus와 `ko/en/ja/zh/zh-tw` locale을 다시 검증하고, disable은 signed-in 사용자가 수행할 수 있다.
- `(user_id, delivery_date)` unique ledger가 KST 기준 하루 한 번만 queue/claim하도록 한다.
- `saved_rising` 후보가 `rising` 후보보다 먼저 나오고, 최대 3개만 메일에 포함한다.
- approved/limited·rising·green/yellow인 후보만 선택하고, non-ko는 원문 revision과 일치하는 reviewed translation이 없으면 제외한다.
- 제목·요약·안전 신호·locale-safe 상세 링크를 text/html 양쪽에 넣고 HTML을 escape한다.
- relay 환경변수가 없거나 URL이 올바르지 않으면 queue/claim/send를 하지 않고 `not_configured`를 반환한다.
- provider payload에 delivery idempotency key를 넣고 성공/실패/skip을 ledger finish RPC로 기록한다.

## Safety boundary

- 직접 preference/delivery insert/update 권한은 열지 않고, 브라우저는 authenticated preference RPC만 호출한다.
- 이메일에는 private saved metadata나 user id를 포함하지 않는다. 저장 밈 여부는 공개 메일의 우선순위 label로만 표현한다.
- 번역은 public page와 동일하게 reviewed + current만 사용하고, AI/기계 번역을 자동 공개하지 않는다.
- 실제 provider credential, 발송, 수신, unsubscribe/bounce 처리와 production DB 적용은 이 artifact 범위가 아니다.

## External gates

- `20260809150000_plus_daily_signal_email.sql`의 Supabase migration/RLS/RPC 실행은 승인되지 않았고 수행하지 않았다.
- `PLUS_DIGEST_DELIVERY_URL`, `PLUS_DIGEST_DELIVERY_TOKEN`, `PLUS_DIGEST_FROM_EMAIL`은 checkout과 production에 설정하지 않았다.
- 실제 이메일 발송·수신·unsubscribe, Plus 인증 세션의 end-to-end, production deploy/push/merge는 미검증이다.
