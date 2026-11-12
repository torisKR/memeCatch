// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient } = vi.hoisted(() => ({
  createStaticClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/auth-menu", () => ({
  AuthMenu: () => null,
  HideOnAdmin: ({ children }: { children: React.ReactNode }) => children,
}));

import KoreanRootLayout from "@/app/(default)/layout";
import AboutPage from "@/app/(default)/about/page";
import ContactPage from "@/app/(default)/contact/page";
import WeeklyPage from "@/app/(default)/weekly/page";
import RankingsLayout from "@/app/rankings/layout";
import RankingsPage, { generateMetadata } from "@/app/rankings/page";
import RankingsNotFound, { metadata as notFoundMetadata } from "@/app/rankings/not-found";
import sitemap, { clearSitemapCache } from "@/app/sitemap";
import { GET as llmsTxt } from "@/app/llms.txt/route";
import { clearKoreanRankingsCache } from "@/lib/korean-rankings.server";

describe("rankings failure path", () => {
  beforeEach(() => {
    clearKoreanRankingsCache();
    clearSitemapCache();
    createStaticClient.mockImplementation(() => {
      throw new Error("connection refused");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function openMenu(node: ReactNode) {
    render(node);
    await userEvent.setup().click(screen.getByRole("button", { name: "메뉴" }));
  }

  it("drops the rankings link and returns a noindex 404 when the database read throws", async () => {
    const korean = await KoreanRootLayout({ children: <main>content</main> });
    const koreanHtml = renderToStaticMarkup(korean);
    expect(koreanHtml).not.toContain('href="/rankings"');
    expect(koreanHtml).toContain('href="/contact"');

    await openMenu(korean);
    expect(screen.queryByRole("link", { name: "밈캐치 내 급상승" })).toBeNull();
    expect(screen.getByRole("link", { name: "연표" })).toBeTruthy();
    cleanup();

    clearKoreanRankingsCache();
    const rankings = await RankingsLayout({ children: <main>rankings</main> });
    const rankingsHtml = renderToStaticMarkup(rankings);
    expect(rankingsHtml).not.toContain('href="/rankings"');
    await openMenu(rankings);
    expect(screen.queryByRole("link", { name: "밈캐치 내 급상승" })).toBeNull();

    clearKoreanRankingsCache();
    await expect(RankingsPage()).rejects.toThrow("NEXT_NOT_FOUND");
    clearKoreanRankingsCache();
    const metadata = await generateMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(notFoundMetadata.robots).toEqual({ index: false, follow: true });
    expect(notFoundMetadata.title).toBe("랭킹을 잠시 볼 수 없어요");

    const notFoundHtml = renderToStaticMarkup(<RankingsNotFound />);
    expect(notFoundHtml).toContain("랭킹을 잠시 볼 수 없어요");
    expect(notFoundHtml).toContain("순위를 다시 정리하고 있어요. 그동안 밈 사전에서 찾아보세요.");
    expect(notFoundHtml).toContain('href="/explore"');
    expect(notFoundHtml).toContain("밈 사전 보기");
    expect(notFoundHtml).toContain('href="/"');
    expect(notFoundHtml).toContain("홈으로");
    expect(notFoundHtml).not.toContain("이 밈은");
    expect(notFoundHtml).not.toContain("아직 없");
    expect(notFoundHtml).not.toContain("준비 중");
    expect(notFoundHtml).not.toContain("집계 전");

    const pageFiles = [
      "app/(default)/page.tsx",
      "app/(default)/about/page.tsx",
      "app/(default)/contact/page.tsx",
      "app/(default)/explore/page.tsx",
    ];
    for (const file of pageFiles) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toContain('href="/rankings"');
    }

    clearKoreanRankingsCache();
    clearSitemapCache();
    const about = await AboutPage();
    const contact = await ContactPage();
    const weekly = await WeeklyPage();
    for (const page of [about, contact, weekly]) {
      const html = renderToStaticMarkup(
        await KoreanRootLayout({ children: page }),
      );
      expect(html).not.toContain('href="/rankings"');
    }
    expect(renderToStaticMarkup(weekly)).toContain('href="/explore"');

    clearKoreanRankingsCache();
    clearSitemapCache();
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url.endsWith("/rankings"))).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith("/explore"))).toBe(true);

    clearKoreanRankingsCache();
    const llms = await llmsTxt();
    expect(llms.status).toBe(503);
    expect(await llms.text()).not.toContain("/rankings");
  });
});
