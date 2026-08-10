# Loop 116 acceptance — PLUS-038

## 선택한 수직

Plus Action Inbox가 오늘 완료한 후보를 모두 제외해 `empty`가 된 뒤에도, 사용자가 저장해 둔
현재·green 밈에서 안전한 다음 활용 후보를 하나 선택할 수 있게 한다. 새 콘텐츠를 만들거나
저장 메타데이터를 공개하지 않고 기존 `SavedReuseRadar`와 `PlusNextMove`를 연결한다.

## 완료 조건

1. Action Inbox가 `empty`이고 owner-scoped completion read가 `available`일 때만 saved `readyNow`
   후보를 `PlusNextMove`의 입력으로 사용한다.
2. saved fallback 후보는 현재 lifecycle + green safety 신호를 통과한 기존 `SavedReuseRadar`의
   후보만 사용하고, completion의 `completedMemeIds`는 다시 제외한다.
3. `ko`는 canonical detail로 연결하고, `en`·`ja`·`zh`·`zh-tw`는 exact reviewed/current/
   required-field/content-depth gate를 통과한 번역이 있을 때만 localized detail로 연결한다.
   번역 누락·stale·조회 실패는 한국어를 현지어처럼 표시하지 않고 fallback 후보를 숨긴다.
4. Action Inbox가 `active`이거나 `unavailable`이면 기존 후보 우선순위·One-Cut·Next Move
   동작을 변경하지 않는다. saved fallback은 active/unavailable 상태를 덮어쓰지 않는다.
5. rating read가 `unavailable`이면 empty를 ready로 가장하지 않는다. 후보가 없으면 기존
   `empty` 문구를 유지한다.
6. 새 DB table/API/RPC/schema/migration/production write/analytics event를 추가하지 않고,
   private note·saved collection·URL을 새로 노출하지 않는다.
7. `ko`·`en`·`ja`·`zh`·`zh-tw`의 Next Move copy와 접근 가능한 detail/Use Kit 링크를 회귀로
   고정한다.

## 검증

- focused Vitest: Plus Next Move, saved radar, Action Inbox, outcome follow-up, dashboard
- full `pnpm test`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- local Chromium `/premium` with signed-out redirect and, where authenticated fixture data is
  available, empty Action Inbox → saved next candidate observation

## 운영 경계

실제 authenticated Plus/RLS/JWT, Supabase migration 적용, 결제, receipt write, 번역 생성·human
publication, production deploy/push/merge는 이 루프에서 수행하지 않는다.
