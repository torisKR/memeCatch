import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

const getTrendingMemes = vi.hoisted(() => vi.fn());
const createStaticClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queries", () => ({
  getTrendingMemes,
  LIST_SELECT: "id, slug, title",
}));

vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));

import { isYouTubeThumbnailUrl } from "@/lib/retired-card-image";
import {
  RETIRED_PRODUCT_FALLBACK_PICKS,
  RETIRED_PRODUCT_FALLBACK_SLUGS,
  loadRetiredProductMemes,
} from "@/lib/retired-product-memes";

function meme(slug: string, title = slug): MemeListItem {
  return {
    id: `id-${slug}`,
    short_id: slug.slice(0, 8),
    slug,
    title,
    summary: `${title} 설명`,
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "rising",
    media_type: "image",
    origin_year: 2024,
    trend_score: 10,
  } as MemeListItem;
}

function catalog(payload: { data: MemeListItem[] | null; error: { message: string } | null }) {
  const filters: Array<{ column: string; values: unknown }> = [];
  const builder = {
    select() {
      return builder;
    },
    in(column: string, values: unknown) {
      filters.push({ column, values });
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    then(
      onFulfilled?: (value: typeof payload) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(payload).then(onFulfilled, onRejected);
    },
  };
  return {
    filters,
    client: {
      from() {
        return builder;
      },
    },
  };
}

describe("loadRetiredProductMemes", () => {
  beforeEach(() => {
    getTrendingMemes.mockReset();
    createStaticClient.mockReset();
  });

  it("puts verified public art ahead of other trending memes and skips YouTube stills", async () => {
    const verified = meme("ai-slop", "AI 슬롭");
    verified.meme_contents = [{ thumbnail_url: "/ai-memes/ai-slop.jpg", is_representative: true }];
    const bubble = meme("trend-bubble", "말풍선");
    bubble.meme_contents = [];
    const youtube = meme("trend-yt", "유튜브");
    youtube.meme_contents = [{
      thumbnail_url: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
      is_representative: true,
    }];
    const source = catalog({ data: [youtube, bubble, verified], error: null });
    createStaticClient.mockReturnValue(source.client);
    getTrendingMemes.mockResolvedValue([
      youtube,
      bubble,
      meme("trend-2", "급상승 2"),
    ]);

    const memes = await loadRetiredProductMemes();

    expect(memes).toHaveLength(4);
    expect(memes.map((item) => item.slug).slice(0, 3)).toEqual([
      "ai-slop",
      "trend-bubble",
      "trend-2",
    ]);
    expect(memes.map((item) => item.slug)).not.toContain("trend-yt");
    expect(getTrendingMemes).toHaveBeenCalledWith(24);
    expect(source.filters).toContainEqual({
      column: "moderation_status",
      values: ["approved", "limited"],
    });
  });

  it("fills a short catalog with the shipped illustrations and skips unverified slugs", async () => {
    getTrendingMemes.mockResolvedValue([]);
    const onlyOne = meme("ai-slop", "제목 ai-slop");
    onlyOne.meme_contents = [{ thumbnail_url: "/ai-memes/ai-slop.jpg", is_representative: true }];
    const source = catalog({
      data: [onlyOne, meme("꼰대", "꼰대"), meme("치맥", "치맥")],
      error: null,
    });
    createStaticClient.mockReturnValue(source.client);

    const memes = await loadRetiredProductMemes();

    expect(memes).toHaveLength(4);
    expect(memes[0]?.slug).toBe("ai-slop");
    expect(memes.map((item) => item.slug)).not.toContain("꼰대");
    expect(memes.map((item) => item.slug)).not.toContain("치맥");
    expect(memes.slice(1).map((item) => item.slug)).toEqual(
      RETIRED_PRODUCT_FALLBACK_SLUGS.filter((slug) => slug !== "ai-slop"),
    );
  });

  it("uses the shipped illustrations when the catalog cannot load the picks", async () => {
    getTrendingMemes.mockResolvedValue([]);
    const missing = catalog({ data: null, error: { message: "unavailable" } });
    createStaticClient.mockReturnValue(missing.client);

    const memes = await loadRetiredProductMemes();

    expect(memes.map((item) => item.slug)).toEqual([...RETIRED_PRODUCT_FALLBACK_SLUGS]);
    expect(memes.map((item) => item.meme_contents?.[0]?.thumbnail_url)).toEqual(
      RETIRED_PRODUCT_FALLBACK_PICKS.map((pick) => pick.thumbnail),
    );

    createStaticClient.mockImplementation(() => {
      throw new Error("catalog down");
    });
    await expect(loadRetiredProductMemes()).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: "ai-slop" })]),
    );
  });

  it("does not pick 꼰대, 치맥, or a YouTube thumbnail", () => {
    const slugs = RETIRED_PRODUCT_FALLBACK_PICKS.map((pick) => pick.slug);
    expect(slugs).not.toContain("꼰대");
    expect(slugs).not.toContain("치맥");
    expect(slugs).not.toContain("shrimp-jesus");
    expect(slugs).not.toContain("갑툭튀");
    for (const pick of RETIRED_PRODUCT_FALLBACK_PICKS) {
      expect(isYouTubeThumbnailUrl(pick.thumbnail)).toBe(false);
      expect(pick.thumbnail).not.toMatch(/ytimg|youtube/i);
      expect(pick.thumbnail).toMatch(/^\/ai-memes\/[a-z0-9-]+\.jpg$/);
    }
  });
});
