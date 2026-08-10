# Loop 117 acceptance — PLUS-039

## 선택한 수직

Plus One-Cut/Creator Pack가 범용 카드만 내려주고 실제 게시 채널을 다시 묻게 되어, 구독자가
결과물을 바로 사용할 때 한 단계가 끊긴다. 기존 검수된 콘텐츠·export route·receipt만 재사용해
채널 규격을 먼저 선택하고 그 규격의 게시-ready 이미지와 현지어 캡션을 준비한다.

## 완료 조건

1. One-Cut/Creator Pack 생성 전에 접근 가능한 채널 선택을 요구한다. 채널 미선택이면 export
   fetch가 발생하지 않고 명시적 오류를 표시한다.
2. `instagram`·`tiktok`·`youtube`는 기존 `story`(1080×1920), `threads`·`x`·`community`·
   `messaging`·`blog`·`other`는 기존 `card`(1200×630) export format으로 결정론적으로
   매핑한다. 요청 URL은 기존 locale/detail/safety/entitlement gate를 그대로 사용한다.
3. 생성 성공 전에는 활용 완료/receipt를 만들지 않는다. share 취소·일부 export 실패·clipboard
   실패도 완료로 오인하지 않는다.
4. 생성 성공 후 receipt의 채널은 선택한 채널로 미리 채우고, 사용자가 실제 게시 채널을 수정할
   수 있게 한다. 준비된 산출물은 기존 `creator_pack` artifact kind를 유지한다.
5. `ko`·`en`·`ja`·`zh`·`zh-tw` copy와 375×812에서도 채널 선택·상태·receipt가 접근 가능해야
   하며, 기존 free/locked, empty/unavailable, saved fallback, Next Move 경계를 유지한다.
6. 새 DB table/API/RPC/schema/migration/production write/analytics event/OpenAI 호출을 만들지
   않고, 기존 export GET과 명시적 receipt POST만 사용한다.

## 검증

- channel→format pure helper 및 기존 Creator Pack regression
- Plus Global Action Inbox One-Cut channel selection/export/receipt tests
- `pnpm test`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- local Chromium signed-out `/premium` boundary 및, fixture가 있으면 authenticated One-Cut
  channel output observation

## 운영 경계

실제 결제·authenticated Plus/RLS/JWT·receipt production write·외부 게시·Supabase migration·
human translation publication·production deploy/push/merge는 이 루프에서 수행하지 않는다.
