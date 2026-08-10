# Loop 090 acceptance — legacy 번역 batch → source-locked intake

## 목표

Loop 052에서 이미 생성된 4-locale machine draft가 새 intake schema 차이 때문에 버려지지 않도록,
기존 문구·provenance·source snapshot을 보존한 채 reviewable machine artifact로 넘긴다.

## 수용 조건

- intake는 canonical `meme`와 legacy `source` source object를 모두 읽는다.
- `snapshot_hash` 또는 `source_snapshot_hash`가 있으면 현재 source snapshot 재계산값과 일치해야 한다.
- worklist membership, duplicate, 4-locale completeness, target-language, source-fidelity gate는 유지한다.
- pack provenance의 `gpt-5.6-luna`는 `provider=openai`, `model=gpt-5.6-luna`으로 보존한다.
- Postgres `+00` timestamp를 검증하되 source hash에 사용된 원문 timestamp는 변경하지 않는다.
- 기본 실행은 report-only이고, `--emit-artifact --require-complete`에서만 SQL artifact를 만든다.
- artifact는 source-locked, idempotent `status=machine` insert만 포함하며 reviewed/publication은 하지 않는다.
- canonical loop-050에 이미 있는 동일 행은 duplicate로 차단한다.
