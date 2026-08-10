# Loop 124 acceptance — PLUS-044

## 수직

Plus 사용자가 최근 활용 receipt와 평가를 다시 찾고 다음 선택의 근거로 삼을 수 있는 bounded
Outcome History를 `/premium`에 추가한다.

## 수락 기준

- active Plus는 기존 `plus_meme_use_receipts`를 KST 최근 30일·최대 50건으로 읽고, 완료일 desc와
  receipt id asc로 결정론적으로 정렬한다.
- 각 row는 제목·완료일·채널·콘텐츠 언어·산출물·성과 메모 상태·평가·canonical 밈 상세 링크를
  표시하고, 채널·평가 필터는 client-side read-only 상태로 동작한다.
- non-Plus는 같은 loader에서 DB를 조회하지 않고 locked 상태를 `/premium`의 기존 PremiumGate
  아래에 표시한다. row 없음은 empty, query/parse/관계 오류는 unavailable이다.
- `result_url`·`private_note`는 Supabase select·parser DTO·렌더링에 포함하지 않는다. href는
  내부 경로만 허용한다.
- RSC 경계에서는 function-valued copy를 전달하지 않고 locale만 전달해 client에서 copy를
  선택한다. ko/en/ja/zh/zh-tw copy와 접근 가능한 Next Link를 제공한다.
- 새 DB/API/RPC/schema/migration/receipt write/analytics/OpenAI/publication은 없다.

## 제외

authenticated Plus populated browser, production RLS/receipt/payment, live translation publication,
`/rankings` 기존 smoke marker mismatch와 SEO-001 soft-404는 이번 루프에서 닫지 않는다.
