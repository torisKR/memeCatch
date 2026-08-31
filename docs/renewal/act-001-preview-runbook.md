# ACT-001 격리 Preview 실행·종료 Runbook

## 목적과 금지선

ACT-001은 production을 건드리지 않고 격리 preview에서 결제 → entitlement → one-cut → receipt → refresh read-back을 증명한다. preview DB, Unifi test 결제 자격증명, preview 배포와 사람 검수 fixture만 사용한다. production key, service-role을 브라우저 principal로 쓰는 방식, 실제 자금 결제, 자동 공개는 허용하지 않는다.

production의 `UNIFI_PAY_CHECKOUT_ENABLED`는 계속 `false`다. 격리 Preview에서 사람이 실제 Unifi test checkout 하나를 생성할 때만 Preview 플래그를 정확히 `true`로 잠시 열고, 주문 생성 직후 즉시 `false`로 복구한다. 이후 webhook/refund는 플래그와 무관하게 계속 동작해야 한다.

## 고정 AI·미디어 경계

- 모델은 정확히 `stealth/ox-alpha`다.
- 허용 비용은 `$0`이며 유료 모델 폴백은 없다.
- upstream 실패나 한도 초과 시 fail-closed하고 다른 모델로 재시도하지 않는다.
- AI 초안은 사람 검수 전 자동 공개하지 않는다.
- 외부 원본 이미지·영상·오디오는 다운로드하거나 영속 저장하지 않는다.

## 격리 환경과 principal

preview Supabase는 production과 별도 프로젝트여야 하고 production-like migration ledger를 가져야 한다. 아래 principal은 서로 다른 사용자/JWT로 만든다.

| Principal | 상태 | 허용 기대값 |
| --- | --- | --- |
| `signed_out` | 세션 없음 | pricing 조회, premium 로그인 redirect; 주문·receipt 불가 |
| `free_user` | 로그인, entitlement 없음 | 자기 주문 조회만 가능; Plus action·receipt 불가 |
| `active_owner` | 로그인, active Plus | 자기 one-cut 수행, receipt 작성·재조회 가능 |
| `expired_owner` | 로그인, 만료 Plus | 새 Plus action·receipt 불가; 허용된 자기 과거 기록만 조회 |
| `other_active_owner` | 별도 active Plus | 자기 데이터만 접근; `active_owner`의 주문·receipt 0행 |
| `refund_operator` | 서버 service-role 운영 경로 | 검증된 원거래 환불 RPC만 실행; 브라우저에 자격증명 노출 금지 |

한 JWT를 여러 역할에 재사용하거나 owner ID만 바꿔 negative matrix를 흉내 내지 않는다.

## 증적 디렉터리

clean RC의 12자리 SHA와 UTC timestamp로 아래 root를 만든다.

```text
artifacts/renewal/act-001/<sha12>-<utc>/
├── manifest.json
├── release.json
├── migrations.json
├── payment.json
├── privacy.json
├── matrix.json
└── browser.md
```

`manifest.json`은 위 파일의 상대 경로, SHA-256, 생성 시각, target preview origin과 clean release SHA를 묶는다. secret, JWT, API key, 결제 서명 원문, 검색어, private/performance note는 어느 artifact에도 기록하지 않는다.

## 1. Prerequisite gate

운영 셸에 다음 값만 주입한다. 값 자체는 `.env*`, shell history, artifact 또는 로그에 남기지 않는다.

- `ACT001_PREFLIGHT_BASE_URL`: 격리 preview origin
- `ACT001_PREFLIGHT_SUPABASE_URL`: 격리 preview Supabase origin
- `ACT001_PREFLIGHT_SUPABASE_ANON_KEY`: 해당 preview anon key
- `ACT001_PREFLIGHT_SUPABASE_PREVIEW_JWT`: active preview 사용자 단기 JWT
- `ACT001_PREFLIGHT_SUPABASE_SERVICE_ROLE_KEY`: read-only OpenAPI catalog probe 전용 preview service-role key
- `ACT001_EVIDENCE_MANIFEST`: 위 evidence root의 `manifest.json` 절대 경로

`prerequisite`와 `closure` 모두 base URL, Supabase URL, anon key, preview JWT, preflight service-role key가 필수다. preflight service-role key는 read-only OpenAPI catalog probe에만 사용하고 artifact, 로그, 브라우저에 기록하거나 전달하지 않는다. `prerequisite`는 `ACT001_EVIDENCE_MANIFEST`가 필수다.

```bash
pnpm run plus:activation:preflight -- prerequisite --json
```

READY 전에는 preview runner를 실행하지 않는다. prerequisite는 clean RC SHA, 세 route의 동일 release marker, target migration/RPC catalog, scoped JWT core access, Unifi test evidence 준비 상태, privacy artifact 계약을 read-only로 확인해야 한다. BLOCKED면 출력된 이유를 해결하고 새 evidence root에서 다시 시작한다.

## 2. Preview 실행

사람이 검수한 reviewed/current 영어 fixture 하나를 사용한다.

runner를 시작하는 운영 셸에는 다음 preview 전용 credential을 별도로 주입한다.

- `ACT001_PREVIEW_APP_ORIGIN`: manifest `appUrl`과 정확히 같은 격리 preview app origin
- `ACT001_PREVIEW_SUPABASE_ORIGIN`: manifest `supabaseUrl`과 정확히 같은 격리 preview Supabase origin
- `ACT001_PRODUCTION_APP_ORIGIN`: preview와 달라야 하는 필수 production app origin 경계값
- `ACT001_PRODUCTION_SUPABASE_ORIGIN`: preview와 달라야 하는 필수 production Supabase origin 경계값
- `ACT001_PREVIEW_SUPABASE_ANON_KEY`: manifest의 격리 preview Supabase anon key
- `ACT001_PREVIEW_OWNER_JWT`: active owner 단기 JWT
- `ACT001_PREVIEW_FREE_JWT`: entitlement가 없는 별도 사용자 JWT
- `ACT001_PREVIEW_EXPIRED_JWT`: 만료 entitlement를 가진 별도 사용자 JWT
- `ACT001_PREVIEW_CROSS_OWNER_JWT`: cross-owner 격리를 확인할 별도 active 사용자 JWT
- `ACT001_PREVIEW_SUPABASE_SERVICE_ROLE_KEY`: 기존 결제·entitlement DB 상태 조회 전용 preview service-role key
- `ACT001_PREVIEW_REFUND_SERVICE_ROLE_KEY`: 기존 refund DB 상태 조회 전용 preview service-role key

preview origin 두 개는 manifest 값과 byte-for-byte 정규화 기준으로 정확히 일치하고, 필수 production origin 두 개와 각각 달라야 한다. 이 네 경계가 확인되기 전에는 credential을 사용하거나 matrix DB 접근을 시작하지 않는다. 네 사용자 JWT의 `sub`는 모두 달라야 한다. 두 service-role key는 브라우저로 전달하거나 artifact·명령 출력에 기록하지 않는다.

```bash
pnpm run plus:activation:preview -- --manifest "$ACT001_EVIDENCE_MANIFEST" --json
```

runner는 결제 주문·거래를 생성하거나 합성하지 않고 settlement/refund 상태를 변경하지 않으며 Unifi provider API를 독립 조회하지도 않는다. refund RPC는 authenticated 권한 거부를 확인하는 비변경 permission probe만 실행한다. 사람이 검토하고 SHA-256으로 manifest에 묶은 redacted `browser.md`의 실제 confirmed Unifi test identity와 이미 존재하는 DB/RLS 상태를 읽어 다음 경계를 검증한다.

1. hashed `browser.md`와 manifest의 실제 confirmed Unifi test identity 일치
2. 기존 `billing_orders` CONFIRMED 상태와 active entitlement 일치
3. active owner의 실제 one-cut receipt와 refresh read-back
4. signed-out billing/receipt read, cross-owner billing-order read, authenticated refund RPC의 fail-closed 상태

성공 결과는 `READ_MATRIX_PASS`다. 결과 JSON은 `runId`, `commitSha`, redacted access-boundary 결과를 포함한다. 이 JSON을 evidence root 안에 저장하고 SHA-256 artifact reference를 closure의 `payment.matrix.accessBoundary.artifact`에 기록한다. closure는 access-boundary의 run/SHA가 payment matrix의 동일 run/SHA와 다르거나 artifact hash가 실제 bytes와 다르면 거부한다. `READ_MATRIX_PASS`는 payment/provider/browser 절차 완료 선언이 아니며, runner result 또는 해시 증적에 명시되지 않은 receipt idempotency나 analytics delivery를 증명하지 않는다. provider authenticity는 사람이 검토한 hashed `browser.md`와 DB state의 결합으로만 판단한다.

canceled/refund provider evidence가 manifest에 없으면 runner는 해당 항목을 `contract-only`로 명시하고 provider 거래를 만들거나 환불하지 않는다. 이는 preview read matrix의 제한 상태일 뿐 closure 통과가 아니다. closure는 동일 실제 confirmed transaction에 연결된 필수 verified refund matrix artifact가 없으면 계속 BLOCKED다.

## 3. RLS·환불 matrix

| 시나리오 | 기대 결과 |
| --- | --- |
| signed-out가 `billing_orders`/receipt 조회 | 거부 또는 0행 |
| free/expired가 Plus receipt 작성 | 거부, 행 변화 없음 |
| active owner가 자기 receipt 작성·재조회 | 성공 |
| other active owner가 owner 주문·receipt 조회 | 0행 |
| active owner가 다른 owner ID로 receipt 작성 | 거부 |
| 일반 authenticated가 환불 RPC 실행 | 거부 |
| 기존 미확인·중복·타 주문 환불 증적 | fail-closed 상태와 권한 무변경을 조회로 확인 |
| 기존 확인된 원거래 환불 증적 | 동일 provider 거래, 멱등 기록과 해당 entitlement 조정을 조회로 확인 |
| checkout flag `false`에서 신규 checkout | 차단 |
| checkout flag `false`에서 기존 webhook/refund | 계속 처리 |

환불 테스트는 Unifi test 거래만 사용한다. production wallet 서명이나 실제 자금 이동은 이 runbook 범위가 아니다.

## 4. Closure gate

기본적으로 closure는 같은 `ACT001_EVIDENCE_MANIFEST`에서 prerequisite와 closure 연속성을 검증한다. post-payment closure evidence를 manifest와 별도 파일로 관리할 때만 `ACT001_CLOSURE_EVIDENCE`에 그 경로를 설정한다. 이 변수는 선택값이며, 별도 파일을 사용하지 않으면 설정하지 않는다.

```bash
pnpm run plus:activation:preflight -- closure --json
```

closure는 prerequisite와 `READ_MATRIX_PASS`에 더해 다음 별도 증적을 모두 통과해야 READY다.

- 사람이 실제 Unifi test 거래와 refund identity를 확인한 provider review
- 동일 거래에 연결된 **verified refund matrix artifact**
- 같은 run/SHA에 묶인 signed-out/cross-owner/refund 권한 거부 matrix artifact
- `deliveryVerified=true`와 `rawQueryAbsent=true`를 포함하는 hashed analytics evidence
- receipt refresh read-back과 멱등성을 명시적으로 기록한 해시 증적

canceled/refund가 `contract-only`이거나 refund artifact가 없으면 BLOCKED다. analytics 파일이 없거나 `deliveryVerified`/`rawQueryAbsent` 중 하나라도 `true`가 아니면 BLOCKED다. 실행 뒤 fixture 정리 결과도 manifest에 포함한다. closure BLOCKED 상태에서는 production checkout을 켜지 않는다.

## 5. Production-safe 활성화 순서

1. checkout off로 foundation(migration/RLS/webhook/refund/privacy)을 배포한다.
2. Global Daily의 기존 공급량을 보존할 수 있도록 서로 다른 production 문서의 fully eligible trust resolve를 최소 12건 완료한다.
3. enforcement와 activation gate를 적용한다.
4. signed-out/Free/active/expired/cross-owner, webhook/refund, analytics privacy smoke를 수행한다.
5. closure READY를 확인한 뒤 마지막 단계에서만 `UNIFI_PAY_CHECKOUT_ENABLED=true`로 바꾼다.

## 롤백

문제가 생기면 `UNIFI_PAY_CHECKOUT_ENABLED=false`로 신규 checkout만 즉시 차단한다. 배포된 webhook route, 상태 재검증, 기존 PENDING/CONFIRMED 주문 처리와 refund RPC는 유지한다. 결제 이력을 삭제하거나 Latpeed legacy 경로로 신규 주문을 우회하지 않는다.
