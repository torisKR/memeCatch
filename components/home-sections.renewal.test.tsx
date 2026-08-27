import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePathwaysSection } from "@/components/home-sections";

describe("HomePathwaysSection renewal", () => {
  it("keeps the three destinations in a mobile-first 1-column, 2-to-1 editorial grid", () => {
    const html = renderToStaticMarkup(<HomePathwaysSection />);

    expect(html).toContain("grid-cols-1");
    expect(html).toContain("lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]");
    expect(html).toContain("lg:row-span-2");
    expect(html).toContain('href="/collections"');
    expect(html).toContain('href="/timeline"');
    expect(html).toContain('href="/collections/beginner"');
  });
});
