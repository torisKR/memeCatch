# Loop 093 acceptance — PLUS-026 Outcome Follow-up

## Target

Plus 사용자가 활용 완료 후 나중에 성과 메모를 보충하고, 최근 결과를 다시 확인할 수 있어야 한다.
기존 Outcome Ledger 안의 단일 수직으로 제공하며 새 대시보드 카드는 추가하지 않는다.

## Baseline

- Loop 091 private Outcome Ledger: `성과 입력 대기 N건` 집계는 있었지만 후속 입력 경로가 없었다.
- Global translation artifact: 로컬 기준 `448/1,520`, `en=122`, `ja=142`, `zh=90`, `zh-tw=94`.
- Production DB, migration, authenticated Plus session, human review/publication은 이번 루프의 범위가 아니다.

## Acceptance

- [x] 최근 7일 `plus_meme_use_receipts`에서 최대 5건을 읽고 성과 미입력 항목을 먼저 정렬한다.
- [x] client DTO는 제목·날짜·채널·locale·artifact·performance note만 포함한다.
- [x] signed-out/free 계정은 follow-up query/RPC에 도달하지 않는다.
- [x] performance RPC/API는 본인·active Plus·미입력 receipt만 한 번 갱신한다.
- [x] 기존 performance note는 덮어쓰지 않는다.
- [x] 성과 메모는 필수이며 최대 1,000자다.
- [x] 저장 성공 시 7일 대기 수와 follow-up item이 새로고침 없이 갱신된다.
- [x] 저장 실패 시 입력값이 유지된다.
- [x] `ko`·`en`·`ja`·`zh`·`zh-tw` copy와 채널/locale/artifact 라벨을 제공한다.
- [x] URL fetch, private note 노출, SNS 자동 게시, AI 호출, translation/publication 변경이 없다.

## Human / production gates

- [ ] Supabase migration 적용
- [ ] authenticated JWT/RLS/RPC E2E
- [ ] 실제 Plus receipt/performance 저장
- [ ] production deploy 및 공개 release
