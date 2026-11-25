# 2026-11-25 밈 수집·공개 기록

운영 DB에 이미 적용된 작업의 기록이다. 다시 적용하지 않는다.

- `batch.json`: 2000~2026 시기별·게임 분야 수집 124개. 기존 5,106개(모든 상태)와 제목·별칭·괄호 뺀 제목 기준 중복 제외. `scripts/ingest-meme-content.mjs --sql`로 pending 삽입.
- `review-new/`: 124개 재검증. 출처를 다시 열어 사실을 대조하고 틀린 문장은 고쳐서 공개. 121 공개, 2 보류(잼민이: 연령 비하어, 트램펄린 토끼 AI 영상: 국내 유행 근거 없음), 1 거절(점 하나 찍고 민소희: `점 하나로 변신` 중복).
- `review-pending/`: 기존 pending 78개 검토. 43 공개(줴줴이야·감다살·테토남·Italian Brainrot 등), 4 거절(중복), 31 보류. Rage Comics·asdfmovie·Philosoraptor·Fail Whale·영원할 건가 보다는 국내 유행 근거가 약해 운영자 판단으로 보류.
- 공개는 `pending → fact_checking → rights_checking → approved` 순서로 상태 전이 트리거를 거쳤다. 공개분은 모두 출처 2개 이상.
- 번역(en/ja/zh/zh-tw)은 아직 없다. `pnpm translate:memes -- --status=missing`으로 채운다.
