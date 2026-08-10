# Loop 119 acceptance — PLUS-041

## 선택한 수직

Loop 118은 Creator Pack의 게시 채널을 학습했지만, 실제 공유 문구는 검수된 제목·요약·
안전 안내에 머물렀다. 이번 루프는 기존 reviewed usage_examples를 상황 기반 One-Cut
선택으로 연결해 Plus 구독자가 바로 보낼 한 줄을 고르게 한다.

## 완료 조건

1. 공통 parser는 비어 있지 않은 situation/text만 최대 3개 통과시킨다.
2. 한국어는 canonical source 예문만, 외국어는 source_updated_at이 원문 updated_at과
   같은 reviewed translation row의 예문만 사용한다. 외국어에서 한국어 예문으로 fallback하지 않는다.
3. Scout·Translation Fulfillment·Daily Signal의 예문이 Action Inbox creatorPackFacts로
   전달되고, One-Cut selector는 최대 3개 상황과 선택 text preview를 노출한다.
4. 선택한 예문 text는 기존 localized caption·safety·detail link와 함께 Creator Pack
   share text에 들어간다. 예문이 없으면 생성하지 않는 상태를 표시하고 generic pack만 준비한다.
5. 기존 channel selection, story/card export, explicit creator_pack receipt, completion,
   entitlement/privacy와 five-locale copy를 유지한다.
6. 새 DB/API/RPC/schema/migration/production write/analytics/OpenAI/publication surface를
   추가하지 않는다. 관리자 GPT 보조 검수의 gpt-5.6-sol + high reasoning strict contract와
   human approval/publication gate를 유지한다.

## 검증 계획

- focused Plus/usage example tests
- full Vitest suite
- TypeScript, ESLint, production build, diff check
- One-Cut component flow: situation selection → channel selection → export mock → preview

## 운영 경계

실제 authenticated Plus/RLS/payment/receipt write, live reviewed 공급 측정, 사람 번역 pack
publication, Supabase 적용, production deploy/push/merge는 이번 루프의 범위가 아니다.
