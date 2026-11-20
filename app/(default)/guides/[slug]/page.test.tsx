import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import GuidePage, { generateMetadata, generateStaticParams } from "@/app/(default)/guides/[slug]/page";
import GuidesPage from "@/app/(default)/guides/page";
import { GUIDES } from "@/lib/guides";

const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("guide pages", () => {
  it("prerenders exactly the five guide slugs", () => {
    expect(generateStaticParams()).toEqual(GUIDES.map((g) => ({ slug: g.slug })));
  });

  it("calls notFound for an unknown slug", async () => {
    await expect(GuidePage(params("no-such-guide"))).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders a guide with its sections and sources", async () => {
    const guide = GUIDES.find((g) => g.slug === "short-form-challenge-rights")!;
    const html = renderToStaticMarkup(await GuidePage(params(guide.slug)));
    expect(html).toContain('class="page-title');
    expect(html).toContain(guide.sections[0].heading);
    for (const source of guide.sources) expect(html).toContain(source.publisher);
  });

  it("sets a canonical URL per guide", async () => {
    const metadata = await generateMetadata(params("usage-signals"));
    expect(metadata.alternates?.canonical).toBe("/guides/usage-signals");
  });

  it("lists every guide on the index", () => {
    const html = renderToStaticMarkup(<GuidesPage />);
    for (const guide of GUIDES) expect(html).toContain(`/guides/${guide.slug}`);
  });
});
