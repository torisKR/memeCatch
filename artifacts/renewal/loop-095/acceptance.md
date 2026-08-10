# Loop 095 acceptance

## 목표

글로벌 번역 intake가 historical artifact의 중복·unsafe SQL을 현재 공개 공급으로
잘못 합치지 않도록 canonical `(meme_id, locale)` preflight를 제공한다.

## 완료 조건

- `--existing-artifact-dir`를 반복 지정할 수 있고, 기존 artifact를 read-only로 읽는다.
- 기존 행을 `existingSafeRows`와 `existingUnsafeRows`로 파일 단위 분리한다.
- 입력 행을 `newRows`, `duplicateExistingRows`, `duplicateInputRows`,
  `sourceMismatchRows`, `outOfWorklistRows`로 분류한다.
- `missingBefore`, `missingAfter`, locale별 coverage delta를 계산한다.
- 별도 historical directory의 unsafe 오류는 격리 경고로 남기고, clean new pack의
  machine-only artifact emit을 막지 않는다.
- output directory 자체의 unsafe row·parse error는 emit 전에 fail-closed 한다.
- 기존 human review/publication gate, production DB/API/OpenAI write 경계를 변경하지 않는다.

## 범위 밖

Loop 050 historical SQL 수정·삭제·적용, 신규 번역 생성, 운영자 human review, Supabase
write, 공개 발행, Plus 기능 추가, production deploy는 수행하지 않는다.
