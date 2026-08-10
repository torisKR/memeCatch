import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

const loadPlusLocalizedFeed = vi.hoisted(() => vi.fn());

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/plus-localized-feed.server", () => ({ loadPlusLocalizedFeed }));
vi.mock("@/components/reveal", () => ({
  Reveal: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <section {...props}>{children}</section>
  ),
}));
vi.mock("@/components/motion-list", () => ({
  MotionList: ({ children, ...props }: { children: ReactNode; [key: string]: unknown }) => (
    <ul {...props}>{children}</ul>
  ),
}));
vi.mock("@/components/meme-card", () => ({
  MemeCard: ({ meme, href }: { meme: MemeListItem; href?: string }) => (
    <a href={href}>{meme.title} {meme.summary}</a>
  ),
}));

import { MyFeed } from "@/components/my-feed";

const meme: MemeListItem = {
  id: "meme-1",
  short_id: "short-1",
  slug: "localized-meme",
  title: "Localized meme",
  summary: "Localized summary",
  category: "phrase",
  safety_level: "green",
  lifecycle_status: "rising",
  media_type: "image",
  origin_year: 2026,
  trend_score: 99,
  meme_contents: [],
};

describe("MyFeed localized rendering", () => {
  it("renders translated editorial fields and the same-locale href", async () => {
    loadPlusLocalizedFeed.mockResolvedValue({
      state: "active",
      contentLocale: "en",
      usedFresh: false,
      items: [{ meme, href: "/en/memes/short-1-localized-meme" }],
    });

    const html = renderToStaticMarkup(
      await MyFeed({ interests: ["phrase"], locale: "en", isPremium: true }),
    );

    expect(html).toContain('href="/en/memes/short-1-localized-meme"');
    expect(html).toContain("Localized meme");
    expect(html).not.toContain("한국어");
  });

  it("keeps empty coverage visibly different in Traditional Chinese", async () => {
    loadPlusLocalizedFeed.mockResolvedValue({
      state: "empty-coverage",
      contentLocale: "zh-tw",
      usedFresh: false,
      items: [],
    });

    const html = renderToStaticMarkup(
      await MyFeed({ interests: ["phrase"], locale: "zh-tw", isPremium: true }),
    );

    expect(html).toContain("人工審核");
    expect(html).not.toContain("暂时没有可显示的迷因");
  });
});
