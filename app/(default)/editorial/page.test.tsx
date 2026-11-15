import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import EditorialPage from "@/app/(default)/editorial/page";
import AboutPage, { generateMetadata } from "@/app/(default)/about/page";

const koreanCount = vi.hoisted(() => ({ value: 531 as number | null }));

vi.mock("@/app/sitemap", () => ({
  getIndexableKoreanMemeCount: async () => koreanCount.value,
}));

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
    expect(html).toContain("밈이 아니라 인터넷 문화 사건 기록이에요");
    expect(html).toContain("사건·인물 기록");
    expect(html).toContain("게임 고유명사");
    expect(html).toContain("toris@toris.kr");
    expect(html).toContain("/support");
    expect(html).toContain("광고와 편집의 분리");
    expect(html).not.toMatch(/제휴 링크|상품 가격|애드픽|adpick|\/products/i);
    expect(html.length).toBeGreaterThan(8000);
  });

  it("about links to editorial and lists contact channels", async () => {
    koreanCount.value = 531;
    const html = renderToStaticMarkup(await AboutPage());
    expect(html).toContain("/editorial");
    expect(html).toContain("toris@toris.kr");
    expect(html).toContain("/support");
    expect(html).toContain("toris-dev");
    expect(html).toContain("531건");
    expect(html).not.toContain("3,000");
    expect(html).not.toMatch(/제휴 링크|\/products|adpick/i);
    const metadata = await generateMetadata();
    expect(metadata.description).toContain("531건");
    expect(metadata.description).not.toContain("3,000");
  });

  it("about drops the number when the published catalog cannot be counted", async () => {
    koreanCount.value = null;
    const html = renderToStaticMarkup(await AboutPage());
    expect(html).toContain("공개된 한국 밈을 기록하고 있습니다.");
    expect(html).not.toContain("3,000");
    expect(html).not.toMatch(/\d[\d,]*건/);
  });
});
