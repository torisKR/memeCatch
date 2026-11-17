import { describe, expect, it } from "vitest";
import {
  mergeSearchPresentationItems,
  searchPresentationKey,
} from "@/lib/search-presentation";

const curated = {
  id: "curated-ohiryeo-joha",
  short_id: "oyj2021k",
  title: "오히려 좋아",
};
const catalog = {
  id: "00000000-0000-4000-8000-000000000006",
  short_id: "6hgbgvxs",
  title: "오히려 좋아",
};
const seed = { ...curated, id: "5062885d-2d6f-577c-a7dd-2187b1cf3bd2" };

describe("search presentation identity", () => {
  it("gives only the explicit curated and catalog pair one presentation key", () => {
    expect(searchPresentationKey(curated)).toBe(searchPresentationKey(catalog));
    expect(searchPresentationKey({ ...catalog, short_id: "same-title" })).not.toBe(
      searchPresentationKey(catalog),
    );
  });

  it("prefers the catalog item while preserving unrelated same-title items", () => {
    const unrelated = {
      id: "00000000-0000-4000-8000-000000000007",
      short_id: "another-id",
      title: "오히려 좋아",
    };

    expect(mergeSearchPresentationItems([curated], [unrelated, catalog])).toEqual([
      unrelated,
      catalog,
    ]);
  });

  it("keeps the curated fallback when the catalog item is absent", () => {
    expect(mergeSearchPresentationItems([curated], [])).toEqual([curated]);
    expect(mergeSearchPresentationItems([curated], [seed])).toEqual([seed]);
  });

  it("prefers the explicit catalog ID over the database seed in either order and across pages", () => {
    expect(mergeSearchPresentationItems([curated], [seed, catalog])).toEqual([catalog]);
    expect(mergeSearchPresentationItems([catalog, seed])).toEqual([catalog]);
    expect(mergeSearchPresentationItems([seed], [catalog])).toEqual([catalog]);
    expect(mergeSearchPresentationItems([catalog], [seed])).toEqual([catalog]);
  });

  it("replaces an earlier curated item when the catalog item arrives later", () => {
    const before = { id: "before", short_id: "before" };
    expect(mergeSearchPresentationItems([before, curated], [catalog])).toEqual([
      before,
      catalog,
    ]);
  });
});
