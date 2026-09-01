import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const createStaticClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));
import { CountryFlagBadge } from "@/components/country-flag-badge";
import { MemeCard } from "@/components/meme-card";
import { countryFlag, originCountryCode } from "@/lib/meme-country";
import { LIST_SELECT, searchMemes, type MemeListItem } from "@/lib/queries";

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
  meme_market_profiles: [
    { market_code: "US", role: "origin", review_state: "reviewed" },
  ],
} as MemeListItem;

describe("meme country display", () => {
  it("renders the reviewed US origin as a top-left flag", () => {
    const html = renderToStaticMarkup(<MemeCard meme={meme} />);

    expect(countryFlag("US")).toBe("🇺🇸");
    expect(html).toContain('data-country-flag-position="top-left"');
    expect(html).toContain('data-country-flag="US"');
    expect(html).toContain("미국 밈");
  });

  it("uses an accessible globe when the origin is unknown", () => {
    const html = renderToStaticMarkup(<CountryFlagBadge code={null} />);

    expect(html).toContain("🌐");
    expect(html).toContain('role="img"');
    expect(html).toContain("출처 국가 미확인");
    expect(html).toContain('data-country-code="UNKNOWN"');
    expect(html).toContain('data-country-flag="unknown"');
  });

  it("ignores unreviewed and non-origin market profiles", () => {
    expect(
      originCountryCode([
        { market_code: "JP", role: "origin", review_state: "draft" },
        { market_code: "US", role: "adaptation", review_state: "reviewed" },
      ]),
    ).toBeNull();
  });

  it("loads the reviewed origin relation in shared list queries", () => {
    expect(LIST_SELECT).toContain(
      "meme_market_profiles(market_code, role, review_state)",
    );
  });

  it("loads the reviewed origin relation for search result cards", async () => {
    const select = vi.fn().mockResolvedValue({ data: [meme], error: null });
    const rpc = vi.fn(() => ({ select }));
    createStaticClient.mockReturnValue({ rpc });

    const results = await searchMemes("미국 밈");

    expect(rpc).toHaveBeenCalledWith("search_memes", {
      p_query: "미국 밈",
      p_limit: 20,
    });
    expect(select).toHaveBeenCalledWith(LIST_SELECT);
    expect(results[0]?.meme_market_profiles?.[0]?.market_code).toBe("US");
  });
});
