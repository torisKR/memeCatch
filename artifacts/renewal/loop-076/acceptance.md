# Loop 076 Acceptance — LOC-009

## 목표

관리자가 선택한 글로벌 locale에서 번역 행이 없는 공개 밈을 확인하고, 명시적인 클릭으로만
GPT-5.6-sol high 번역 초안을 저장·발행 없이 미리 본다.

## 수용 기준

- [x] `/admin/translations`에서 locale을 선택하면 `approved`·`limited` 원문만 missing 후보로 표시한다.
- [x] `machine`·`reviewed`·`stale`를 포함해 이미 `(meme_id, locale)` 행이 있는 밈은 후보에서 제외한다.
- [x] 원문 및 번역 목록이 1,000행 경계를 넘을 수 있도록 range pagination을 사용한다.
- [x] 버튼을 누르기 전에는 GPT를 호출하지 않고, 클릭 시 `gpt-5.6-sol`과 `reasoning.effort=high` strict schema 계약을 사용한다.
- [x] 초안은 source-only 입력, 불확실성 보존, 사람 검수 필요, 저장·발행하지 않음 경계를 표시한다.
- [x] GPT 호출 직후 source revision과 번역 부재를 재검증하고 변경 시 결과를 폐기한다.
- [x] 새 경로는 insert/update/delete, audit log, RPC, revalidation, 자동 저장·발행을 호출하지 않는다.
- [x] 비운영자·비공개 밈·기존 번역·revision 충돌은 안전한 오류로 닫힌다.

## 범위 밖

번역 DB 적용, 자동 승인/공개, offline batch 생성, production deploy, authenticated operator/GPT
실행과 실제 Supabase RLS 검증은 별도 운영 게이트다.
