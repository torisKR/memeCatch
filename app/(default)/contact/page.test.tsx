import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ContactPage from "@/app/(default)/contact/page";

describe("contact page", () => {
  it("offers email and a deletion request without a login wall", () => {
    const html = renderToStaticMarkup(<ContactPage />);
    expect(html).toContain("문의");
    expect(html).toContain("mailto:toris@toris.kr");
    expect(html).toContain("삭제 요청");
    expect(html).toContain(encodeURIComponent("밈캐치 삭제 요청"));
    expect(html).toContain('href="/editorial"');
    expect(html).not.toContain('href="/login"');
  });
});
