# Loop 118 acceptance — PLUS-040

## 선택한 수직

Loop 117은 게시 채널을 선택해 `story` 또는 `card` Creator Pack을 준비하지만, 다음
Creator Pack을 만들 때마다 채널 선택이 빈 상태에서 시작한다. 기존 Plus 사용 결과
평가(`hit`·`neutral`·`miss`)와 이미 저장되는 게시 채널을 owner-scoped 읽기 범위에서
재사용해, 최근 28일의 실제 성과가 양수이고 표본이 충분한 채널을 다음 Creator Pack의
추천값으로 제시한다.

## 완료 조건

1. Plus 전용 최근 평가 조회가 기존 `plus_meme_use_receipts`의 `channel`과
   `performance_rating`을 함께 읽고, Free·signed-out·조회 실패에는 owner 결과나 추천
   데이터를 노출하지 않는다.
2. 추천은 순수 결정 로직으로 계산한다. 전체 평가가 3건 미만이거나 후보 채널 평가가
   2건 미만이면 추천하지 않고, `hit=+1`·`neutral=0`·`miss=-1` 점수의 최상위 채널이
   양수일 때만 추천한다. 동점은 hit 비율, 표본 수, 최신 평가, 고정 채널 순서로
   결정한다.
3. 추천 채널이 있으면 기존 Creator Pack 채널 선택기의 초기값으로 표시하고, 최근
   평가 표본 수만 근거 문구로 표시한다. 사용자가 채널을 직접 바꾼 뒤에는 추천 계산이
   선택값을 덮어쓰지 않는다.
4. 추천값은 기존 `creatorPackFormatForChannel()`에만 연결한다. Instagram·TikTok·YouTube
   `story`, 나머지 채널 `card`, One-Cut의 준비 성공 후 `creator_pack` receipt gate,
   share/clipboard 실패 경계는 그대로 유지한다.
5. `ko`·`en`·`ja`·`zh`·`zh-tw`에서 추천 문구와 선택 UI가 접근 가능하고, 추천 없음·낮은
   표본·중립/실패만 있는 결과는 기존 필수 채널 선택 흐름으로 fail-closed 한다.
6. 새 DB table/API/RPC/schema/migration/production write/analytics/OpenAI 호출을 만들지
   않는다. 기존 receipt query는 Plus owner scope와 기존 28일 날짜 범위를 유지한다.

## 검증

- 추천 projection의 표본/점수/동점/invalid 입력 regression
- outcome rating loader의 channel select 및 non-Plus/unavailable 경계
- One-Cut Creator Pack 추천 초기값·직접 선택 보존·기존 story/card export/receipt regression
- `pnpm test`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- `git diff --check`
- local Chromium signed-out `/premium` boundary 및, fixture가 있으면 authenticated Plus 추천 UI

## 운영 경계

실제 결제·authenticated Plus/RLS/JWT·receipt production write·외부 게시·Supabase migration·
human translation publication·production deploy/push/merge는 이 루프에서 수행하지 않는다.
