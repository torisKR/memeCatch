import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DiscoveryDestinations } from "@/components/discovery-destinations";

describe("DiscoveryDestinations", () => {
  it("puts latest memes and community participation in the first home section", () => {
    const html = renderToStaticMarkup(<DiscoveryDestinations />);

    expect(html).toContain('aria-label="바로 가기"');
    expect(html).toContain('href="/explore?sort=recent"');
    expect(html).toContain('href="/community"');
    expect(html).not.toContain('href="/products"');
    expect(html).toContain('href="/community/new"');
    expect(html).toContain('href="/submit"');
    expect(html).not.toContain('href="/products/new"');
    expect(html).toContain("이야기 나누기");
    expect(html).toContain("밈 제보");
    expect(html).not.toContain("내 밈 상품 등록");
  });

  it("keeps mobile shortcuts touch-sized, keyboard-visible, and motion-aware", () => {
    const html = renderToStaticMarkup(<DiscoveryDestinations />);

    expect(html).toContain("grid-cols-2");
    expect(html).toContain("min-h-12");
    expect(html).toContain("min-h-11");
    expect(html).toContain("focus-visible:outline");
    expect(html).toContain("motion-reduce:transition-none");
  });
});
