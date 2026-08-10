# Loop 062 acceptance

## Target

`SUB-001` — active Plus 사용자가 직접 저장한 밈의 재상승을 `saved_rising` 알림으로 발견하고,
관심사 일반 알림과 중복 없이 다시 상세 페이지로 이동한다.

## Acceptance contract

- 후보는 `has_active_plus()`를 통과한 사용자와 그 사용자의 `saved_memes`에만 한정된다.
- 밈은 공개 가능한 `approved`/`limited`, 최근 14일, `rising` 상태만 후보가 된다.
- 저장한 밈은 `saved_rising`으로 표시되고, 같은 밈의 일반 `rising` 알림은 중복 생성되지 않는다.
- 사용자별 최대 15개, `(user_id, meme_id, kind)` 중복 방지, 30일 보존을 유지한다.
- fan-out 함수는 service role만 실행하고, 클라이언트는 user id·kind·private saved metadata를 쓸 수 없다.
- signed-out/non-Plus는 API에서 잠기며, Plus UI의 라벨·CTA·숫자는 현재 locale을 사용한다.

## Release boundary

코드와 로컬 검증은 완료했지만 production migration/RLS/cron 확인이 끝나지 않았으므로 SUB-001 전체
완료나 공개 Plus 혜택으로 선언하지 않는다.
