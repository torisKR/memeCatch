import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import EditorialPage from "@/app/editorial/page";
import AboutPage from "@/app/about/page";

describe("smoke", () => {
  it("editorial renders with real pipeline constants", () => {
    const html = renderToStaticMarkup(<EditorialPage />);
    expect(html).toContain("편집 원칙");
    expect(html).toContain('id="corrections"');
    for (const s of ["써도 됨", "맥락 주의", "이미 늦음", "쓰면 위험"]) {
      expect(html).toContain(s);
    }
    for (const s of ["공식 임베드", "최초 확인 출처", "저작권 위험 차단"]) {
      expect(html).toContain(s);
    }
    expect(html).toContain("toris@toris.kr");
    expect(html).toContain("/support");
    expect(html.length).toBeGreaterThan(8000);
  });

  it("about links to editorial and lists contact channels", () => {
    const html = renderToStaticMarkup(<AboutPage />);
    expect(html).toContain("/editorial");
    expect(html).toContain("toris@toris.kr");
    expect(html).toContain("/support");
    expect(html).toContain("toris-dev");
  });
});
