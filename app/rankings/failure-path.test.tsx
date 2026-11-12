// @vitest-environment jsdom

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
import RankingsLayout from "@/app/rankings/layout";
import RankingsPage, { generateMetadata } from "@/app/rankings/page";
import { metadata as notFoundMetadata } from "@/app/rankings/not-found";
import { clearKoreanRankingsCache } from "@/lib/korean-rankings.server";

describe("rankings failure path", () => {
  beforeEach(() => {
    clearKoreanRankingsCache();
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
  });
});
