# Loop 106 acceptance — LOC-018 Coverage-Empty Original Explore Action

## 목표

글로벌 locale Explore가 검수 번역 부족으로 `coverage-empty`가 되었을 때도 방문자가
한국어 원본 탐색으로 이어질 수 있는 명확한 다음 행동을 제공한다.

## 범위

- `/en|ja|zh|zh-tw/explore`의 `coverage-empty` 상태에만 한국어 원본 `/explore` CTA를 추가한다.
- 기존 exact locale reviewed/current/depth/no-fallback 공개 게이트와 `active` 카드 렌더를 유지한다.
- `unavailable`에는 CTA를 추가하지 않는다.
- 새 DB/API/schema/dependency, 번역 생성·publication, production write는 추가하지 않는다.

## 완료 기준

1. 네 SEO locale의 `coverage-empty`에 visible, keyboard-focusable `/explore` 링크가 있다.
2. `active`와 `unavailable` 결과에는 해당 CTA가 없다.
3. 기존 locale copy와 metadata/canonical/robots 계약을 유지한다.
4. focused test, full test, typecheck, lint, build, diff check, 네 locale local HTTP를 통과한다.
