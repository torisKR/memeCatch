import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

const getTrendingMemes = vi.hoisted(() => vi.fn());
const createStaticClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queries", () => ({
  getTrendingMemes,
  LIST_SELECT: "id, slug, title",
}));

vi.mock("@/lib/supabase/server", () => ({ createStaticClient }));

import {
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

  it("keeps trending memes and does not query the curated slugs", async () => {
    getTrendingMemes.mockResolvedValue([1, 2].map((index) => meme(`trend-${index}`, `급상승 ${index}`)));

    const memes = await loadRetiredProductMemes();

    expect(memes.map((item) => item.title)).toEqual(["급상승 1", "급상승 2"]);
    expect(createStaticClient).not.toHaveBeenCalled();
  });

  it("falls back to the four curated published slugs, in constant order", async () => {
    getTrendingMemes.mockResolvedValue([]);
    const shuffled = [
      meme("갑툭튀", "갑툭튀"),
      meme("shrimp-jesus", "새우 예수"),
      meme("꼰대", "꼰대"),
      meme("치맥", "치맥"),
      meme("not-curated", "제외"),
    ];
    const source = catalog({ data: shuffled, error: null });
    createStaticClient.mockReturnValue(source.client);

    const memes = await loadRetiredProductMemes();

    expect(memes.map((item) => item.slug)).toEqual([...RETIRED_PRODUCT_FALLBACK_SLUGS]);
    expect(memes.map((item) => item.title)).toEqual(["새우 예수", "치맥", "꼰대", "갑툭튀"]);
    expect(source.filters).toContainEqual({
      column: "slug",
      values: [...RETIRED_PRODUCT_FALLBACK_SLUGS],
    });
    expect(source.filters).toContainEqual({
      column: "moderation_status",
      values: ["approved", "limited"],
    });
  });

  it("returns no cards when the curated slugs cannot be loaded", async () => {
    getTrendingMemes.mockResolvedValue([]);
    const missing = catalog({ data: null, error: { message: "unavailable" } });
    createStaticClient.mockReturnValue(missing.client);

    await expect(loadRetiredProductMemes()).resolves.toEqual([]);

    createStaticClient.mockImplementation(() => {
      throw new Error("catalog down");
    });
    await expect(loadRetiredProductMemes()).resolves.toEqual([]);
  });
});
