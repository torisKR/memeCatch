# Loop 092 acceptance — LOC-007 machine-only translation artifact gate

## 목표

관리자 GPT 검수 계약(`gpt-5.6-sol`, reasoning `high`, strict JSON, `store=false`)과
오프라인 번역 artifact의 경계를 유지한다. 검수용 SQL은 source-locked `machine` 초안
INSERT만 허용하고, 기존 artifact에 섞인 `reviewed` 승격·직접 mutation은 checker에서
실패시킨다.

## 수용 조건

- `translation-batch-check`가 `meme_translations` 대상 UPDATE·DELETE·MERGE와 CALL/RPC
  형태를 오류로 분류한다.
- `status='reviewed'`, non-null `reviewed_at` 또는 non-null `reviewed_by`를 가진 INSERT를
  machine-only artifact로 통과시키지 않는다.
- source-locked atomic `machine` SQL 1개 밈 × `en`·`ja`·`zh`·`zh-tw` 4행은
  `--require-complete`에서 통과한다.
- historical `artifacts/renewal/loop-050`은 기존 파일을 수정하지 않은 채 안전 게이트에서
  실패하고, 위험 파일과 행 수가 JSON 증적으로 남는다.
- checker는 SQL을 실행하지 않으며, 이번 루프는 OpenAI 호출·Supabase write·human review·
  공개 발행·sitemap/Plus ready 전환을 수행하지 않는다.

## 운영 게이트

새 번역을 실제로 생성하거나 적용하는 작업은 이 루프의 범위 밖이다. 기존 artifact는
삭제·수정하지 않고 운영자가 검수할 때까지 보류한다. 공개 전이는 기존 operator CAS와
`reviewed/current` gate에서만 수행한다.
