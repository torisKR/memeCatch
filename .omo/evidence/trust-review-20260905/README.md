# One-Cut 검수 대기 10건

운영 DB에서 읽은 검수 준비 자료입니다. 사람 검수 완료, 출처 사실 확인, 권리 승인 또는 공개 변경을 의미하지 않습니다.

2026-09-05 기준 10건 모두 같은 출처에 연결된 verified origin/meaning claim이 없습니다. 9건은 source role이 `usage_example`이므로 현 상태로 One-Cut에 사용할 수 없습니다.

## 검수 순서

1. [원문 링크와 DB 기록](./candidates.json)의 canonical_url을 열고 실제 밈과 출처를 대조합니다.
2. 업로드일과 밈 발생일을 구분해 origin/meaning 주장을 작성합니다. 사용 예시를 최초 유래로 승격하지 않습니다.
3. source role과 권리 근거를 확인합니다. `official_embed`는 소유권이나 재업로드 허가가 아닙니다.
4. 운영자 로그인으로 기존 원자적 trust resolver를 사용합니다. 해결할 수 없는 문서는 기존 절차에 따라 limited/비공개를 검토합니다.
5. 서로 다른 최소 5개 문서의 trusted predicate를 확인한 뒤 production enforcement를 진행합니다.

공식 exporter는 기존 `lib/plus-trusted-evidence-exporter.server.ts`를 사용합니다. 이번 자료는 pending 검수 큐이며 owner별 exporter 실행이나 UI 상위 5개 순서 일치를 주장하지 않습니다. 운영 DB·콘텐츠·공개 상태·결제·유료 AI 호출은 변경하지 않았습니다.
