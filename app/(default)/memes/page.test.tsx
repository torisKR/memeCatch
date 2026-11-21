// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeDirectoryItem } from "@/lib/meme-directory";

const mocks = vi.hoisted(() => ({
  loadMemeDirectory: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  permanentRedirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT ${path}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/meme-directory.server", () => ({ loadMemeDirectory: mocks.loadMemeDirectory }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  permanentRedirect: mocks.permanentRedirect,
}));

import MemeDirectoryPage, { generateMetadata } from "./page";

function items(count: number): MemeDirectoryItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    short_id: `s${i}`,
    slug: `slug-${i}`,
    title: `밈 ${String(i).padStart(3, "0")}`,
    summary: `요약 ${i}`,
    category: "phrase",
    origin_year: 2020,
  }));
}

const params = (page?: string) => Promise.resolve(page === undefined ? {} : { page });

afterEach(cleanup);
beforeEach(() => {
  mocks.loadMemeDirectory.mockResolvedValue({ ok: true, items: items(250) });
});

describe("/memes directory", () => {
  it("lists 100 crawlable links with title and summary on page 1 and links forward", async () => {
    const { container } = render(await MemeDirectoryPage({ searchParams: params() }));
    const memeLinks = [...container.querySelectorAll("ol a")];
    expect(memeLinks).toHaveLength(100);
    expect(memeLinks[0].getAttribute("href")).toBe("/memes/s0-slug-0");
    expect(container.querySelector("ol li p")?.textContent).toBe("요약 0");
    expect(container.querySelector('a[rel="next"]')?.getAttribute("href")).toBe("/memes?page=2");
    expect(container.querySelector('a[rel="prev"]')).toBeNull();
  });

  it("links both neighbours from a middle page and every page number", async () => {
    const { container } = render(await MemeDirectoryPage({ searchParams: params("2") }));
    expect(container.querySelector('a[rel="prev"]')?.getAttribute("href")).toBe("/memes");
    expect(container.querySelector('a[rel="next"]')?.getAttribute("href")).toBe("/memes?page=3");
    expect(container.querySelector("ol")?.getAttribute("start")).toBe("101");
    const pageLinks = [...container.querySelectorAll('nav[aria-label="목록 페이지"] li a')].map((a) => a.getAttribute("href"));
    expect(pageLinks).toEqual(["/memes", "/memes?page=3"]);
  });

  it("uses each page as its own canonical with matching og/twitter text", async () => {
    const first = await generateMetadata({ searchParams: params() });
    expect(first.alternates?.canonical).toBe("/memes");
    const third = await generateMetadata({ searchParams: params("3") });
    expect(third.alternates?.canonical).toBe("/memes?page=3");
    expect(third.openGraph?.title).toBe(third.title);
    expect(third.twitter?.description).toBe(third.description);
    expect(String(third.description).length).toBeGreaterThanOrEqual(80);
  });

  it("404s out-of-range or malformed pages and folds ?page=1 into /memes", async () => {
    await expect(generateMetadata({ searchParams: params("4") })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata({ searchParams: params("0") })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata({ searchParams: params("abc") })).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(generateMetadata({ searchParams: params("1") })).rejects.toThrow("NEXT_REDIRECT /memes");
  });

  it("fails loudly instead of rendering an empty list when the catalog is down", async () => {
    mocks.loadMemeDirectory.mockResolvedValue({ ok: false });
    await expect(generateMetadata({ searchParams: params() })).rejects.toThrow(/unavailable/);
  });
});
