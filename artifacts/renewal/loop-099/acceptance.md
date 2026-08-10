# Loop 099 acceptance

## Selected vertical

`LOC-015` — 글로벌 번역 coverage의 누락 수를 기존 로케일별 누락 작업 화면으로 직접 연결.

## Acceptance

- `TranslationCoveragePanel`의 로케일별 `누락` 수가 0보다 크면 `/admin/translations?locale=<locale>` 링크를 제공한다.
- 링크는 기존 `listMissingMemeTranslations`와 `MissingTranslationDraftPreview` 경로를 재사용해 최신순 누락 원문 작업 목록으로 이동한다.
- 링크의 accessible name에 언어명·누락 수·작업 의도를 포함한다.
- 누락 수가 0이면 숫자만 표시하고 작업 링크를 만들지 않는다.
- 기존 `검토 필요`·`원문 변경` 링크와 Plus 요청 claim 흐름은 변경하지 않는다.

## Out of scope

번역 생성·OpenAI 호출, machine→reviewed 승인, 공개 발행, source-readiness 계산, Plus completion trigger,
production Supabase write/migration, authenticated operator E2E, deploy, push, merge, and external publication.
