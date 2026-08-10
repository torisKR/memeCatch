# Loop 130 Acceptance — ACT-001-RC

## 목표

Plus 구독자가 결제 뒤 실제 가치 경로를 사용할 수 있는지 production에 쓰지 않고 판정한다.
`payment → entitlement → eligible action → receipt → outcome`을 preview 증거로 연결할 수 있을 때만
READY를 허용하고, 자격증명·스키마·릴리스·개인정보 증거가 없으면 BLOCKED로 남긴다.

## 구현 범위

- `scripts/plus-activation-preflight.mjs`: read-only GET/manual redirect preflight CLI
- `scripts/plus-activation-preflight.test.mjs`: JWT/catalog/auth/redirect/timeout/SHA/artifact/CLI contract
- `next.config.ts`: 배포 commit을 `X-MemeCatch-Release-Sha`로 표시할 선택적 response header
- `package.json`: `plus:activation:preflight:test` 명령

## 판정 계약

- core relation은 실제 `billing_*`, `plus_meme_use_completions`, `plus_meme_use_receipts`만 사용한다.
- outcome rating은 별도 테이블이 아니라 receipts column/RPC 및 migration으로 확인한다.
- Supabase schema catalog와 core authenticated read는 scoped preview JWT를 사용하며 401/403은 통과하지 않는다.
- supporting translation/digest/context relation은 `supportingDegraded`로 분리한다.
- release evidence는 clean preview SHA, Unifi test E2E, privacy provider/outcome/retention, target migration ledger를 요구한다.
- artifact는 root 내부 상대 경로의 실제 바이트 SHA-256, 최근 timestamp, realpath containment를 통과해야 한다.
- 세 public route는 동일한 release SHA를 반환해야 하며, 모든 probe는 timeout/manual redirect를 사용한다.
- production write, payment 실행, migration 적용, translation publication, deploy는 범위 밖이다.

## 종료 기준

코드·테스트·local production surface는 완료한다. 실제 preview credentials와 operator/legal approval이 없으면
production activation 완료로 선언하지 않는다.
