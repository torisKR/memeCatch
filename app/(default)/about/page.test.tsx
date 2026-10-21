import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AboutPage, { metadata } from "./page";

describe("AboutPage", () => {
  it("describes catalog publication separately from editorial completeness", () => {
    const html = renderToStaticMarkup(<AboutPage />);

    expect(html).toContain("공개되어 있다는 사실이 모든 항목의");
    expect(html).toContain("재사용 허락이나 라이선스가 생기는 것은 아닙니다");
    expect(html).toContain("임베드·수집 링크가 일시적으로");
    expect(html).toContain('href="/guides/reading-memes"');
    expect(html).not.toContain("3,000여 건");
    expect(html).not.toContain("확인되지 않는 항목은 공개하지 않습니다");
    expect(html).not.toContain("자동으로 내려갑니다");
  });

  it("keeps the operator and correction channels visible", () => {
    const html = renderToStaticMarkup(<AboutPage />);

    expect(html).toContain("toris-dev");
    expect(html).toContain("toris@toris.kr");
    expect(html).toContain('href="/support"');
    expect(metadata.alternates).toEqual({ canonical: "/about" });
  });

  it("does not mistake internal views or lifecycle for external popularity or safety", () => {
    const html = renderToStaticMarkup(<AboutPage />);

    expect(html).toContain("밈캐치 안의 조회·저장 반응");
    expect(html).toContain("외부 확산 근거가 확인된 항목");
    expect(html).toContain("유행이 지났다는 사실과 사용 위험은 별개");
    expect(html).not.toContain("생애주기를 실시간 조회 데이터 기반");
    expect(html).not.toContain("맥락 주의 / 이미 늦음 / 쓰면 위험");
  });
});
