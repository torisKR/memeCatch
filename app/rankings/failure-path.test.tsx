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
import LocaleRankingsLayout from "@/app/locale-rankings/[locale]/layout";
import RankingsLayout from "@/app/rankings/layout";
import RankingsPage, { RankingsScreen, generateMetadata, generateRankingsMetadata } from "@/app/rankings/page";
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

  it("keeps the rankings link and returns a noindex 200 when the database read throws", async () => {
    const korean = await KoreanRootLayout({ children: <main>content</main> });
    const koreanHtml = renderToStaticMarkup(korean);
    expect(koreanHtml).toContain('href="/rankings"');
    expect(koreanHtml).toContain('href="/contact"');

    await openMenu(korean);
    const menuLinks = screen.getAllByRole("link", { name: "밈캐치 내 급상승" });
    expect(menuLinks.length).toBeGreaterThan(0);
    expect(menuLinks.every((link) => link.getAttribute("href") === "/rankings")).toBe(true);
    expect(screen.getByRole("link", { name: "연표" })).toBeTruthy();
    cleanup();

    clearKoreanRankingsCache();
    const rankings = await RankingsLayout({ children: <main>rankings</main> });
    const rankingsHtml = renderToStaticMarkup(rankings);
    expect(rankingsHtml).toContain('href="/rankings"');
    await openMenu(rankings);
    expect(screen.getAllByRole("link", { name: "밈캐치 내 급상승" }).length).toBeGreaterThan(0);

    clearKoreanRankingsCache();
    const page = await RankingsPage();
    const pageHtml = renderToStaticMarkup(page);
    expect(pageHtml).toContain("<h1");
    expect(pageHtml).toContain("밈캐치 내 급상승");
    expect(pageHtml).toContain("순위를 잠시 불러오지 못했어요. 잠시 후 다시 확인해 주세요.");
    expect(pageHtml).toContain('href="/explore"');
    expect(pageHtml).toContain("밈 사전 보기");
    expect(pageHtml).not.toContain("error");
    expect(pageHtml).not.toContain("500");
    expect(pageHtml).not.toContain("<table");
    expect(pageHtml).not.toContain("이 밈은");
    expect(pageHtml).not.toContain("아직 없");
    expect(pageHtml).not.toContain("준비 중");
    expect(pageHtml).not.toContain("집계 전");

    clearKoreanRankingsCache();
    const metadata = await generateMetadata();
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(metadata.title).toBe("밈캐치 내 급상승");

    const pageFiles = [
      "app/(default)/page.tsx",
      "app/(default)/about/page.tsx",
      "app/(default)/contact/page.tsx",
      "app/(default)/explore/page.tsx",
    ];
    for (const file of pageFiles) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toContain('href="/rankings"');
    }
    expect(readFileSync(join(process.cwd(), "components/site-footer.tsx"), "utf8")).toContain('href: "/rankings"');
    expect(readFileSync(join(process.cwd(), "components/header-menu.tsx"), "utf8")).toContain('href: "/rankings"');

    clearKoreanRankingsCache();
    clearSitemapCache();
    const about = await AboutPage();
    const contact = await ContactPage();
    const weekly = await WeeklyPage();
    for (const rendered of [about, contact, weekly]) {
      const html = renderToStaticMarkup(
        await KoreanRootLayout({ children: rendered }),
      );
      expect(html).toContain('href="/rankings"');
    }
    expect(renderToStaticMarkup(weekly)).toContain('href="/explore"');
    expect(renderToStaticMarkup(weekly)).toContain('href="/rankings"');

    clearKoreanRankingsCache();
    clearSitemapCache();
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url.endsWith("/rankings"))).toBe(false);
    expect(entries.some((entry) => entry.url.includes("/ar/rankings"))).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith("/explore"))).toBe(true);

    clearKoreanRankingsCache();
    const llms = await llmsTxt();
    expect(llms.status).toBe(503);
    expect(await llms.text()).not.toContain("/rankings");

    clearKoreanRankingsCache();
    const arabic = await LocaleRankingsLayout({
      children: await RankingsScreen({ locale: "ar" }),
      params: Promise.resolve({ locale: "ar" }),
    });
    const arabicHtml = renderToStaticMarkup(arabic);
    expect(arabicHtml).toMatch(/^<html lang="ar" dir="rtl">/);
    expect(arabicHtml).toContain('dir="rtl"');
    expect(arabicHtml).toContain("text-right");
    expect(arabicHtml).toContain("justify-start");
    expect(arabicHtml).toContain("تعذر تحميل التصنيفات الآن. يُرجى المحاولة مرة أخرى بعد قليل.");
    expect(arabicHtml).toContain("التصنيفات");
    expect(arabicHtml).toContain('href="/explore"');
    expect(arabicHtml).not.toContain('href="/ar/explore"');
    expect(arabicHtml).toContain('href="/rankings"');
    expect(arabicHtml).not.toContain("순위를 잠시 불러오지 못했어요");
    expect(arabicHtml).not.toContain("밈 사전 보기");
    const arabicMeta = await generateRankingsMetadata("ar");
    expect(arabicMeta.robots).toEqual({ index: false, follow: true });
    expect(arabicMeta.title).toBe("التصنيفات");
  });
});
