# Loop 096 acceptance

## 목표

Plus 사용자의 활용 결과가 다음 밈 추천에 실제로 반영되는 개인 학습 루프를 기존 Action Inbox와
Outcome Follow-up 안에 추가한다.

## 완료 조건

- `plus_meme_use_receipts`에 `hit | neutral | miss` 구조화 평가를 추가하고, active Plus 본인의
  receipt만 최초 1회 저장한다.
- 최근 28일·최대 50건만 추천 신호로 읽고, hit는 가산·miss는 감점·동점은 기존 Action Inbox
  순서를 유지한다.
- 평가 3건 미만은 `learning` 상태로 표시하고, 오늘 완료한 밈은 Next Move 후보에서 제외한다.
- Outcome Follow-up에서 평가를 저장하면 같은 화면의 Next Move가 즉시 다시 정렬된다.
- 추천 표면에는 후보의 공개 title·summary·href와 평가 신호만 사용하고 `performance_note`,
  `private_note`, `result_url`를 노출하지 않는다.
- 평가 column이 아직 적용되지 않은 rolling deploy에서는 기존 성과 메모 follow-up이 계속
  동작하고 rating lane만 unavailable로 격리한다.
- 관리자 GPT 검수의 `gpt-5.6-sol` + `reasoning.effort=high` + `store=false` 계약과 글로벌
  reviewed/current 공개 게이트는 변경하지 않는다.

## 범위 밖

Production Supabase migration 적용, authenticated JWT/RLS 실제 fixture 저장, OpenAI 호출,
자동 게시, human review/publication, production deploy, push/merge는 수행하지 않는다.
