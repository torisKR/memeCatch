# Loop 085 acceptance

## 목표

Unifi 결제가 Plus 권한으로 전환되는 서버 경계에서 provider 응답을 fail-closed로 검증한다.

## 수용 조건

- `transactionId`, `orderId`, `storeId`, finite `orderAmount`, `orderCurrencyCode` 중 하나라도 누락·빈 값·비정상이면 status lookup이 `unifi_pay_status_invalid_response`로 실패한다.
- provider transaction ID가 요청 transaction ID와 다르면 권한 처리로 진입하지 않는다.
- 조회 결과의 store·금액·통화가 설정값과 다르면 webhook은 200 ignored를 반환하고 권한을 만들지 않는다.
- 필수 값이 모두 존재하고 configured store·상품 금액·통화와 일치하는 거래만 기존 owner/link 귀속 및 멱등 process flow로 진입한다.
- 이번 루프는 결제 provider 호출, Supabase write, migration 적용, production deploy, 자동 게시를 실행하지 않는다.

## 범위

- `lib/billing/unifi-pay.server.ts`
- `lib/billing/unifi-pay.server.test.ts`
- `app/api/billing/unifi/webhook/route.test.ts`
- Loop 085 상태·백로그·결정·릴리스 증적
