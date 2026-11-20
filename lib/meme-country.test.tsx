import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const createStaticClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/server", () => ({ createStaticClient }));
import { CountryFlagBadge } from "@/components/country-flag-badge";
import { MemeCard } from "@/components/meme-card";
import { localizedMemeCountryLabel, originCountryCode } from "@/lib/meme-country";
import { INDEXABLE_LIST_SELECT, LIST_SELECT, searchMemes, type MemeListItem } from "@/lib/queries";

const meme = {
  id: "us-meme",
  short_id: "us1",
  slug: "us-meme",
  title: "미국 밈",
  summary: "국가 표시 테스트",
  category: "phrase",
  safety_level: "green",
  lifecycle_status: "rising",
  media_type: "image",
  origin_year: 2026,
  trend_score: 1,
  meme_contents: [],
  description: "밈".repeat(340),
  origin: "유".repeat(60),
  meme_sources: [{ source_url: "https://example.com/source" }],
  meme_market_profiles: [
    { market_code: "US", role: "origin", review_state: "reviewed" },
  ],
} as unknown as MemeListItem;

describe("meme country display", () => {
  it("keeps the origin country off the shared poster card", () => {
    const html = renderToStaticMarkup(<MemeCard meme={meme} />);

    expect(html).not.toContain("data-country-flag");
    expect(html).not.toContain("출처 국가");
    expect(html).toContain("2026");
    expect(html).toContain("써도 됨");
  });

  it("uses an accessible globe when the origin is unknown", () => {
    const html = renderToStaticMarkup(<CountryFlagBadge code={null} />);

    expect(html).not.toContain("🌐");
    expect(html).toContain("출처 국가 미확인");
    expect(html).toContain('data-country-code="UNKNOWN"');
    expect(html).toContain('data-country-state="unconfirmed"');
  });

  it("keeps unconfirmed-origin copy on the badge, not the poster card", () => {
    const cardHtml = renderToStaticMarkup(<MemeCard meme={meme} />);
    const localizedHtml = renderToStaticMarkup(<CountryFlagBadge code={null} locale="en" />);

    expect(cardHtml).not.toContain("출처 국가 미확인");
    expect(cardHtml).not.toContain("data-country-flag");
    expect(localizedHtml).toContain("Origin unconfirmed");
    expect(localizedHtml).not.toContain("🌐");
  });

  it("ignores unreviewed and non-origin market profiles", () => {
    expect(
      originCountryCode([
        { market_code: "JP", role: "origin", review_state: "draft" },
        { market_code: "US", role: "adaptation", review_state: "reviewed" },
      ]),
    ).toBeNull();
  });

  it("localizes reviewed country names without changing origin evidence", () => {
    expect(localizedMemeCountryLabel("US", "en")).toBe("United States");
    expect(localizedMemeCountryLabel("KR", "ja")).toBe("韓国");
  });

  it("localizes the usage signal on the poster and leaves the country name off it", () => {
    const korean = renderToStaticMarkup(<MemeCard meme={meme} />);
    const english = renderToStaticMarkup(<MemeCard meme={meme} locale="en" />);
    const japanese = renderToStaticMarkup(<MemeCard meme={meme} locale="ja" />);

    expect(korean).toContain("써도 됨");
    expect(english).toContain("Safe to use");
    expect(english).not.toContain("United States");
    expect(japanese).not.toContain("アメリカ");
    expect(korean).not.toContain("data-country-flag");
  });

  it("loads the reviewed origin relation in shared list queries", () => {
    expect(LIST_SELECT).toContain(
      "meme_market_profiles(market_code, role, review_state)",
    );
  });

  it("loads the reviewed origin relation for search result cards", async () => {
    const publicFilter = vi.fn().mockResolvedValue({ data: [meme], error: null });
    const select = vi.fn(() => ({ in: publicFilter }));
    const rpc = vi.fn(() => ({ select }));
    createStaticClient.mockReturnValue({ rpc });

    const results = await searchMemes("미국 밈");

    expect(rpc).toHaveBeenCalledWith("search_memes", {
      p_query: "미국 밈",
      p_limit: 50,
    }, { get: true });
    expect(select).toHaveBeenCalledWith(INDEXABLE_LIST_SELECT);
    expect(publicFilter).toHaveBeenCalledWith("moderation_status", ["approved", "limited"]);
    expect(results[0]?.meme_market_profiles?.[0]?.market_code).toBe("US");
  });

  it("prefers the explicit catalog equivalent and keeps unrelated same-title results", async () => {
    const unrelated = {
      ...meme,
      id: "same-title-row",
      short_id: "same-title",
      title: "오히려 좋아",
    } as MemeListItem;
    const catalog = {
      ...meme,
      id: "catalog-ohiryeo-row",
      short_id: "6hgbgvxs",
      title: "오히려 좋아",
    } as MemeListItem;
    const publicFilter = vi.fn().mockResolvedValue({ data: [unrelated, catalog], error: null });
    const select = vi.fn(() => ({ in: publicFilter }));
    createStaticClient.mockReturnValue({ rpc: vi.fn(() => ({ select })) });

    const results = await searchMemes("오히려 좋아");

    expect(results.map((item) => item.short_id)).toEqual(["same-title", "6hgbgvxs"]);
    expect(results.map((item) => item.short_id)).not.toContain("oyj2021k");
  });

  it("keeps the curated fallback when its catalog equivalent is not returned", async () => {
    const publicFilter = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn(() => ({ in: publicFilter }));
    createStaticClient.mockReturnValue({ rpc: vi.fn(() => ({ select })) });

    const results = await searchMemes("오히려 좋아");

    expect(results.map((item) => item.short_id)).toContain("oyj2021k");
    expect(results.map((item) => item.short_id)).not.toContain("6hgbgvxs");
  });

  it("prefers the catalog over the database seed in search results", async () => {
    const seed = { ...meme, id: "5062885d-2d6f-577c-a7dd-2187b1cf3bd2", short_id: "oyj2021k", title: "오히려 좋아" };
    const catalog = { ...meme, id: "catalog-ohiryeo-row", short_id: "6hgbgvxs", title: "오히려 좋아" };
    const publicFilter = vi.fn().mockResolvedValue({ data: [seed, catalog], error: null });
    createStaticClient.mockReturnValue({ rpc: vi.fn(() => ({ select: () => ({ in: publicFilter }) })) });
    const results = await searchMemes("오히려 좋아");
    expect(results.map((item) => item.short_id)).toEqual(["6hgbgvxs"]);
  });

  it("fills the search limit after removing duplicate presentation identities", async () => {
    const seed = { ...meme, id: "seed", short_id: "oyj2021k", title: "오히려 좋아" };
    const catalog = { ...meme, id: "catalog", short_id: "6hgbgvxs", title: "오히려 좋아" };
    const other = { ...meme, id: "other", short_id: "other", title: "오히려 좋아" };
    const publicFilter = vi.fn().mockResolvedValue({ data: [seed, catalog, other], error: null });
    createStaticClient.mockReturnValue({ rpc: vi.fn(() => ({ select: () => ({ in: publicFilter }) })) });
    const results = await searchMemes("오히려 좋아", 2);
    expect(results.map((item) => item.short_id)).toEqual(["6hgbgvxs", "other"]);
  });

  it("keeps the curated fallback when its catalog equivalent ranks outside the result limit", async () => {
    const catalog = { ...meme, id: "catalog", short_id: "6hgbgvxs", title: "오히려 좋아" };
    const others = Array.from({ length: 30 }, (_, i) => ({ ...meme, id: `row-${i}`, short_id: `id${i}` }));
    const publicFilter = vi.fn().mockResolvedValue({ data: [...others, catalog], error: null });
    createStaticClient.mockReturnValue({ rpc: vi.fn(() => ({ select: () => ({ in: publicFilter }) })) });

    const results = await searchMemes("오히려 좋아");

    expect(results).toHaveLength(20);
    expect(results[0]?.short_id).toBe("oyj2021k");
    expect(results.map((item) => item.short_id)).not.toContain("6hgbgvxs");
  });

  it("cannot fill 50 results when the capped RPC page contains the duplicate pair", async () => {
    const seed = { ...meme, id: "seed", short_id: "oyj2021k", title: "오히려 좋아" };
    const catalog = { ...meme, id: "catalog", short_id: "6hgbgvxs", title: "오히려 좋아" };
    const others = Array.from({ length: 48 }, (_, i) => ({ ...meme, id: `row-${i}`, short_id: `id${i}` }));
    const publicFilter = vi.fn().mockResolvedValue({ data: [seed, catalog, ...others], error: null });
    const rpc = vi.fn(() => ({ select: () => ({ in: publicFilter }) }));
    createStaticClient.mockReturnValue({ rpc });
    expect(await searchMemes("오히려 좋아", 50)).toHaveLength(49);
    expect(rpc).toHaveBeenCalledWith("search_memes", { p_query: "오히려 좋아", p_limit: 50 }, { get: true });
  });

  it("does not hide a search catalog failure behind curated cards", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const publicFilter = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "catalog down" },
    });
    const select = vi.fn(() => ({ in: publicFilter }));
    createStaticClient.mockReturnValue({ rpc: vi.fn(() => ({ select })) });

    await expect(searchMemes("중꺾마")).rejects.toThrow("search_memes failed");
    expect(errorLog.mock.calls.flat().join(" ")).not.toContain("catalog down");
    errorLog.mockRestore();
  });
});
