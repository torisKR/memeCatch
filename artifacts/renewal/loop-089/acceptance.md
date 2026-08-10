# Loop 089 acceptance — Plus 번역 수요 claim 연속성

## 목표

누락 번역 요청의 `초안 만들기` 진입도 운영자 claim을 먼저 남긴 뒤 GPT-5.6 Sol high 검수 desk로
이동하게 해, Plus 수요 큐의 상태와 실제 운영 작업을 일치시킨다.

## 수용 조건

- `translationStatus === null`인 priority row에서 `claimTranslationPriority({ memeId, locale })`를
  먼저 호출한다.
- claim 성공 뒤에만 `/admin/translations?locale=<locale>&focus=<memeId>`로 이동한다.
- claim 실패 시 route 이동·GPT 호출 없이 큐에 오류를 표시한다.
- 이미 translation row가 있는 row의 claim→`/admin/memes/<memeId>` 경로는 유지한다.
- GPT 검수는 `gpt-5.6-sol`, `reasoning.effort=high`, strict JSON, `store=false` 계약을 유지한다.
- 자동 저장·자동 발행·production DB write·외부 게시를 추가하지 않는다.
- `machine` 행은 기존 `reviewed/current` 공개·sitemap·Plus ready gate를 통과하기 전까지 공개되지 않는다.
