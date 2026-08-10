# Loop 094 acceptance

## Selected vertical

`LOC-012` — 관리자 번역 검수는 `gpt-5.6-sol` + `reasoning.effort=high`로만 실행한다.

## Acceptance

- `/admin/translations`의 GPT 검수 버튼은 server-only Responses 경로를 사용한다.
- 요청 payload는 `model: "gpt-5.6-sol"`, `reasoning: { effort: "high" }`, `store: false`, strict JSON schema를 포함한다.
- 일반 번역 검수와 누락 번역 preview는 계약 drift를 GPT 호출 전에 거부한다.
- GPT 결과는 폼 preview에만 반영되며 자동 저장·자동 발행하지 않는다.
- 공개 전이는 운영자 명시 승인과 `reviewed/current` gate를 통과해야 한다.

## Out of scope

실제 `OPENAI_API_KEY` 호출, authenticated operator session, Supabase migration/write, human publication,
sitemap/Plus ready 전환, deploy/push/merge.
