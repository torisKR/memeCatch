# Loop 136 GLO-008 acceptance

## Target

관리자 번역 화면에서 글로벌 콘텐츠 공급의 다음 검수 행동을 한 번에 결정한다.

## Acceptance

- 현재 작업 큐는 기존 `list_translation_priority_queue`를 유지하고, Control Tower는 active `plus_translation_requests`를 전역 read-only 경로로 별도 조회한다.
- 전역 수요 행은 Data API `max_rows` 경계를 넘도록 1000행 단위로 페이지네이션해 모두 집계한 뒤 UI limit을 적용한다.
- 번역 상태는 meme ID 200개 배치로 조회해 대량 수요에서도 단일 응답 크기에 의존하지 않는다.
- `translationStatus === null`이고 `isIndexableMeme(source) === true`인 `locale + memeId`만 `routeUnlockCandidate`로 표시한다.
- 후보 정렬은 route-unlock 우선, missing 우선, Plus 요청량 내림차순, 최근 요청일 내림차순, meme ID·locale 순으로 결정적이어야 한다.
- 네 SEO locale(`en`, `ja`, `zh`, `zh-tw`)의 coverage와 Plus 수요를 `plus_missing`, `plus_review`, `review`, `stale`, `missing`, `ready` 다음 행동으로 합친다.
- 다음 행동 링크는 기존 `/admin/translations` focus/status 또는 `/admin/memes/:id` 경로만 사용한다.
- priority/coverage 오류는 빈 큐나 0건으로 표시하지 않는다.
- Control Tower는 읽기 전용이다. GPT preview, machine 저장, reviewed 공개, Supabase 적용, production deploy는 자동 실행하지 않는다.

## Explicit non-goals

- 실제 번역 생성·검수 승인·publication
- production migration/RPC write/deploy
- Plus entitlement/RLS 또는 외부 게시 성공 증명
