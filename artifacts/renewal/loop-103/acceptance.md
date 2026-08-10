# Loop 103 acceptance — PLUS-030 One-Cut Value Proof

## 목표

MemeCatch Plus의 결제 전 약속과 결제 후 첫 화면을 이미 구현된 `one_cut` 결과 흐름에 맞춘다. 사용자가 구독 후 바로 확인할 수 있는 핵심 결과를 “검수된 밈 선택 → 게시용 카드 준비 → 실제 사용 기록”으로 좁혀, 기존 Plus 기능을 더 추가하지 않고 체감 가치를 선명하게 만든다.

## 범위

- 한국어·영어·일본어·중국어 간체·중국어 번체의 pricing/active dashboard 문구를 결과 중심으로 정렬한다.
- 기존 one-cut Action Inbox와 Outcome Snapshot 순서를 유지한다. 새 테이블, RPC, 마이그레이션, 결제 상태 판정은 추가하지 않는다.
- pricing 및 Plus 대시보드 결제 폼이 선택한 로케일을 checkout API에 전달하도록 하고, 비로그인 checkout redirect의 `next` 경로도 안전한 지원 로케일로 보존한다.
- 개인정보와 밈 식별자를 보내지 않는 Plus 퍼널 이벤트를 추가한다.
  - `plus_pricing_view`
  - `plus_checkout_started`
  - `plus_checkout_returned`
  - `plus_one_cut_ready`
  - `plus_one_cut_prepared`
  - `plus_receipt_saved`
- 결제 금액 `$20`, 30일 이용권, 자동 갱신 없음, 서버 entitlement/webhook 경계를 변경하지 않는다.

## 완료 기준

1. pricing과 active Plus header가 existing one-cut/outcome proof를 핵심 가치로 설명한다.
2. checkout form의 `locale` 값이 지원 로케일로만 처리되고, 잘못된 값은 기본 `/pricing`으로 안전하게 수렴한다.
3. checkout return은 `confirming`·`confirmed`·`timeout` 상태를 계측하며, entitlement 서버 응답만으로 상태를 갱신한다.
4. one-cut ready/prepared/receipt saved 이벤트에는 PII, private note, result URL, meme ID, title, source URL이 포함되지 않는다.
5. 로컬 focused test, 전체 test, typecheck, lint, production build, local HTTP smoke가 통과한다.
6. 실제 결제·운영 migration·배포·authenticated production E2E는 이번 루프의 승인 게이트로 남긴다.
