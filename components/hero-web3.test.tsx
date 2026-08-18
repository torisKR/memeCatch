import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroWeb3 } from "@/components/hero-web3";

describe("HeroWeb3", () => {
  it("첫 화면에서 무료 사전 답변과 3분 결과 약속을 분명히 한다", () => {
    const html = renderToStaticMarkup(<HeroWeb3 totalCount={1200} />);

    expect(html).toContain("지금 써도 될지까지");
    expect(html).toContain("뜻·유래·현재 안전성은 무료로 확인하세요");
    expect(html).toContain("무료 활용 문구 1개");
    expect(html).toContain("3분 안에 게시 준비");
    expect(html).toContain('action="/search"');
  });
});
