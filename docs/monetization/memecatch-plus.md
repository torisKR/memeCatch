# MemeCatch Plus 수익화·결제 계약

## 현재 상품

MemeCatch Plus는 **$10 USD / 30일 이용권**이다. Unifi Pay Direct가 발급한 결제 링크에서 Kaia USDT로 결제하며 자동 갱신 구독이 아니다. 조기 재구매는 확인된 기존 잔여 기간 뒤에 30일을 이어 붙인다.

무료 사용자는 공개 밈 검색, 안전성·출처 확인과 커뮤니티 접근을 계속 이용한다. Plus는 무제한 저장, 개인화 트렌드 레이더, 검수된 콘텐츠를 활용하는 one-cut/Creator Pack 등 개인 생산성 기능에 한정한다.

## 활성 결제 원장

신규 결제의 canonical 흐름은 Unifi와 `billing_orders`다.

1. 로그인 사용자가 checkout을 요청하면 서버가 `billing_orders`에 PENDING 주문과 고유 `request_id`를 만든다.
2. 서버가 Unifi 결제 링크를 발급하고 provider link를 주문에 연결한다.
3. webhook은 알림 본문만 신뢰하지 않는다. HMAC 인증된 Unifi 상태 조회로 상점, 금액, 통화, 주문 ID와 거래 ID를 다시 검증한다.
4. 확인된 거래 ID를 멱등 반영하고 `billing_subscriptions`의 30일 권한을 생성하거나 연장한다.
5. `billing_webhook_events`와 주문 상태가 재전송, 실패와 환불의 감사 근거다.

브라우저 redirect, `?checkout=return`, 클라이언트 analytics 또는 사용자의 자기신고는 권한 근거가 아니다. 저장소에 남은 Latpeed 라우트·RPC·테이블은 기존 결제 호환과 감사용 **legacy**이며 신규 주문·권한 부여의 기준이 아니다.

## Checkout 안전 플래그

`UNIFI_PAY_CHECKOUT_ENABLED`는 서버 전용 checkout-only 플래그다. 공백 제거 후 정확히 `true`인 경우에만 신규 checkout을 허용한다. 미설정, 빈 값, `false`, `TRUE`, `1` 등은 모두 신규 주문을 차단한다.

이 플래그는 webhook과 환불 정산에서 읽지 않는다. 장애 또는 출시 롤백 때는 checkout만 `false`로 내려 신규 주문을 멈추고, 기존 PENDING/CONFIRMED 주문의 webhook 처리와 환불은 계속 유지한다.

## 환불 계약

환불은 Unifi에서 원거래를 확인·처리한 뒤 service-role 전용 정산 RPC로 반영한다. 원 주문, 환불 거래 ID, 환불 시각과 provider payload를 `billing_orders`에 멱등 기록하고, 해당 원거래가 부여한 권한만 조정한다. 클라이언트와 일반 authenticated principal은 환불 RPC를 실행할 수 없다.

## 출시 순서

운영 활성화 순서는 다음과 같으며 중간 단계를 건너뛰지 않는다.

1. checkout off 상태로 migration, RLS, webhook/refund, analytics privacy 기반을 배포한다.
2. 서로 다른 production 문서의 trust resolve를 최소 5건 완료해 검수 흐름을 확인한다.
3. enforcement와 activation gate를 적용한다.
4. signed-out/Free/active/expired/cross-owner, 결제·환불과 analytics privacy smoke를 수행한다.
5. 모든 closure evidence가 통과한 뒤 마지막으로 checkout을 on 한다.

preview 실행과 증적 계약은 [`../renewal/act-001-preview-runbook.md`](../renewal/act-001-preview-runbook.md)를 따른다. production checkout 활성화는 문서나 local test 통과만으로 승인되지 않는다.

## 개인정보·AI 경계

- analytics event 이름은 유지하지만 raw 검색어 `query`는 공통 `track()` 경계에서 제거되어 GA와 durable event 어느 쪽에도 전송되지 않는다.
- Plus analytics에는 meme ID, 제목, URL, private note, performance note를 넣지 않는다.
- MPE는 정확히 `stealth/ox-alpha`, 비용 `$0`만 허용한다. 유료 모델 폴백은 없다.
- AI 결과는 자동 공개하지 않는다. 외부 원본 이미지·영상·오디오는 영속 저장하지 않는다.

## 운영 지표

- checkout 시작 대비 HMAC 검증 완료율과 권한 반영 시간
- `billing_orders` PENDING 장기 체류, 중복 webhook, 환불과 entitlement 불일치
- 구매 후 one-cut 준비·명시적 receipt·재방문 활성화율
- 30일권 재구매율과 환불율
- analytics privacy audit 위반 0건
