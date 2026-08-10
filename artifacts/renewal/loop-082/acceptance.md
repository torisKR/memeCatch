# LOOP-082 Acceptance — Artifact-first translation intake

이번 루프의 단일 수직은 사람이 제공한 다국어 번역 묶음을 운영자가 검수할 수 있는
오프라인 SQL 아티팩트로 변환하는 intake gate다. 새 문구를 생성하거나 자동 공개하지 않는다.

- JSON pack은 지원 locale `en`, `ja`, `zh`, `zh-tw`만 허용한다.
- 각 밈은 네 locale을 모두 갖고, 동일한 원문 snapshot을 공유해야 한다.
- worklist 밖 밈, 중복 `(meme_id, locale)`, 빈 필수 필드, source revision 불일치는 거부한다.
- 번역은 기존 언어·source fidelity validator를 통과해야 한다.
- 기본 실행은 report-only이며 파일을 쓰지 않는다.
- `--emit-artifact --require-complete`에서만 locale별 idempotent SQL artifact를 만든다.
- 산출 SQL은 `machine` 상태와 `reviewed_at = null`을 유지하고, 기존 source snapshot
  lock 및 `on conflict (meme_id, locale) do nothing`을 보존한다.
- 생성된 artifact는 기존 `translation-batch-check`로 재검증 가능해야 한다.
