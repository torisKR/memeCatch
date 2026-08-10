# Loop 086 acceptance

## 목표

Plus 개인 트렌드 피드를 글로벌 사용자가 실제로 읽을 수 있는 검수 콘텐츠 경계에 연결한다.

## 수용 조건

- `ko`는 기존 관심사 trend ranking·fresh fallback·6개 제한·canonical `/memes/...` 경로를 유지한다.
- `en`·`ja`·`zh`·`zh-tw`는 exact locale `reviewed`, source revision current, localized slug/title/summary/description/origin complete 행만 사용한다.
- localized source는 기존 `isIndexableLocalizedMeme()`와 원문 `isIndexableMeme()` depth/publication contract를 통과해야 한다. source depth 입력에는 description/origin/usage_note/caution/examples/source/content/tag가 포함된다.
- 비한국어 source 후보는 최대 60개를 overfetch한 후 source 순서를 유지하며 최대 6개로 투영한다. stable `id` tie-breaker를 사용한다.
- 관심사 목록이 비어 있거나 성공한 관심사 조회가 비어 있을 때만 fresh source를 읽는다. nonempty 관심사 조회 실패는 fresh로 숨기지 않는다.
- `empty-source`, `empty-coverage`, `unavailable` 상태를 구분한다. UI-only locale은 명시적인 English content label과 `/en/...` 경로를 사용한다.
- `zh-tw` feed 상태 문구는 `zh` fallback과 별도의 번체 copy다.
- free/signed-out 경로는 Plus loader와 translation query를 실행하지 않는다.
- 이번 루프는 migration/RPC/cron/DB write/번역 생성·검수·발행/외부 게시/production deploy를 실행하지 않는다.
