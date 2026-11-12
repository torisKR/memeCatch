import { beforeEach, describe, expect, it, vi } from "vitest";

const { createStaticClient, koreanRankingsVisible } = vi.hoisted(() => ({
  createStaticClient: vi.fn(() => {
    throw new Error("connection refused");
  }),
  koreanRankingsVisible: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));
vi.mock("@/lib/korean-rankings.server", () => ({ koreanRankingsVisible }));

import sitemap, { clearSitemapCache } from "@/app/sitemap";

describe("sitemap rankings visibility", () => {
  beforeEach(() => {
    clearSitemapCache();
    koreanRankingsVisible.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("lists /rankings only when the shared visibility check is true", async () => {
    koreanRankingsVisible.mockResolvedValue(false);
    const hidden = await sitemap();
    expect(hidden.some((entry) => entry.url.endsWith("/rankings"))).toBe(false);
    expect(hidden.some((entry) => entry.url.endsWith("/explore"))).toBe(true);

    koreanRankingsVisible.mockResolvedValue(true);
    clearSitemapCache();
    const shown = await sitemap();
    expect(shown.some((entry) => entry.url.endsWith("/rankings"))).toBe(true);
  });
});
