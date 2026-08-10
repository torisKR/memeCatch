# Loop 104 acceptance — ACT-001 Preview One-Cut Activation Proof

## 목표

Loop 103에서 정렬한 “검수된 밈 선택 → 게시용 카드 준비 → 실제 사용 기록”이 로컬 계약을 넘어 실제 구독자에게 이어지는지, production을 건드리지 않는 격리 preview에서 한 번에 증명한다.

## 이번 루프의 결정

새 Plus 기능이나 번역 UI를 추가하지 않는다. 현재 worktree에는 누적된 로컬 변경이 많고, 실제 병목은 결제·entitlement·DB/RLS·번역 공급·배포의 관찰 증거다. 다음 실행은 clean release candidate와 격리 preview 권한을 먼저 확보한 뒤에만 시작한다.

## 완료 기준

1. 현재 변경에서 one-cut에 필요한 파일만 clean release candidate SHA로 분리하고, 번역 운영 도구·Daily 이메일·Context Watch 등 비필수 표면을 포함하지 않는다.
2. 격리 preview Supabase에 one-cut completion/receipt migration과 필수 선행 스키마를 적용하고 migration ledger와 reviewed rollback 절차를 남긴다. production에는 쓰지 않는다.
3. 실제 JWT 세션에서 signed-out, Free, active Plus, expired Plus, cross-owner의 RPC/RLS 결과를 검증한다.
4. 사람이 검수한 current/reviewed 영어 fixture 하나로 `/en/pricing` → Unifi test payment → webhook/status → active entitlement → one-cut card → 명시적 receipt 저장 → 새로고침 재조회까지 브라우저에서 완주한다.
5. 새로고침 뒤 completion count·streak·receipt가 유지되고, 다른 owner는 해당 receipt를 읽지 못한다.
6. Loop 103의 6개 privacy-safe funnel event가 실제 수신처에 한 번씩 도착하며 meme ID·title·URL·private note가 없다.

## 중단 조건

preview Supabase, 결제 테스트 자격증명, reviewed/current 영어 fixture, clean RC 중 하나라도 없거나 migration 의존성이 두 핵심 migration 밖으로 확장되면 구현하지 않고 `human_gate`로 기록한다.
