import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "app/sitemap.ts"), "utf-8");

/**
 * 사이트맵은 구글에 제출하는 artifact 그 자체다. 여기서 생기는 중복·누락은
 * "신경 써서 큐레이션했다"는 주장을 그대로 무너뜨린다.
 */
describe("사이트맵 페이지네이션 안정성", () => {
  it("range() 페이지네이션에 고유 타이브레이커(id)가 있다", () => {
    // published_at은 동점이 매우 많다(일괄 등록으로 공개 3,905건 중 2,835건이
    // 같은 타임스탬프). 단일 컬럼 정렬로 페이지를 나누면 쿼리마다 정렬이 달라져
    // 경계에서 같은 행을 다시 읽고 다른 행은 건너뛴다. 실제로 URL 2건이 중복
    // 등재되고 충실한 문서 1건이 누락된 적이 있다.
    const paged = source.slice(source.indexOf(".order("), source.lastIndexOf(".range("));
    expect(paged).toContain('.order("published_at"');
    expect(paged).toContain('.order("id"');
  });

  it("얇은 문서를 거르는 단일 판정 함수를 쓴다", () => {
    // 상세의 robots 판정과 같은 함수여야 "사이트맵엔 있는데 noindex" 모순이 없다.
    expect(source).toContain("isIndexableMeme");
  });
});
