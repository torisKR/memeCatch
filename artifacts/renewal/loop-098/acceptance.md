# Loop 098 acceptance

## Selected vertical

`PLUS-028` — Plus가 실제 활용 성과를 첫 화면에서 증명하는 Outcome Snapshot.

## Acceptance

- active Plus `/premium`의 헤더 바로 아래에 서버가 계산한 오늘 활용 수·연속 일수·최근 활용·성과 대기·평가 수를 표시한다.
- Outcome Snapshot은 기존 `get_plus_meme_use_summary`/owner-scoped receipt·rating read model만 사용하며 새 API, RPC, migration, POST를 추가하지 않는다.
- `ready`, `empty`, `unavailable`을 구분하고 조회 실패를 0으로 위장하지 않는다.
- `receiptId`, meme ID, URL, `performance_note`, `private_note`는 Snapshot에 전달하거나 렌더링하지 않는다.
- 채널·언어·산출물의 최대 사용 항목만 기존 5개 Plus locale copy로 표시하고, UI-only locale은 영어 copy로 안전하게 fallback한다.
- Action Inbox와 기존 7일 상세 요약은 유지하며, Action Inbox로 이동하는 명시적 anchor를 제공한다.
- 기존 7일 상세 요약은 기본 펼침 상태로 바꿔 동일한 가치 루프를 첫 방문에서 숨기지 않는다.

## Out of scope

production Supabase migration/write, authenticated Plus/RLS E2E, real receipt/rating storage, translation
generation or publication, external SNS posting, OpenAI call, deploy, push, and merge.
