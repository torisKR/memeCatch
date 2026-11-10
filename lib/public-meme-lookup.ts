export type PublicMemeLookup<Row, Curated> =
  | { kind: "database"; meme: Row }
  | { kind: "curated"; meme: Curated }
  | { kind: "unavailable" }
  | { kind: "missing" };

/**
 * 조회 결과를 화면 분기로 나눈다.
 * 행이 있으면 사전 문서가 우선이다. 행이 없고 편집 카드와 키가 같으면 그 카드를 보여 준다.
 * 카탈로그 오류는 없는 문서가 아니다.
 */
export function classifyPublicMemeLookup<Row, Curated>(input: {
  row: Row | null;
  curated: Curated | null;
  catalogUnavailable: boolean;
}): PublicMemeLookup<Row, Curated> {
  if (input.row) return { kind: "database", meme: input.row };
  if (input.curated) return { kind: "curated", meme: input.curated };
  if (input.catalogUnavailable) return { kind: "unavailable" };
  return { kind: "missing" };
}
