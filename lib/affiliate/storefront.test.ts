import { describe, expect, it } from "vitest";

import {
  buildAffiliateStorefront,
  calculateDiscountRate,
} from "@/lib/affiliate/storefront";
import type { AffiliateStorefrontProduct } from "@/lib/affiliate/types";

const products: Omit<AffiliateStorefrontProduct, "clickCount7d">[] = [
  {
    id: "source-2",
    provider: "adpick",
    sourceType: "hotdeal",
    externalKey: "external-2",
    themeCode: "theme",
    themeTitle: "Theme",
    themeDescription: "Theme description",
    sourceRank: 2,
    productName: "Product 2",
    imageUrl: null,
    mallDomain: null,
    mallName: null,
    mallIconUrl: null,
    salePrice: 12_900,
    originalPrice: 25_800,
  },
  {
    id: "source-1",
    provider: "adpick",
    sourceType: "hotdeal",
    externalKey: "external-1",
    themeCode: null,
    themeTitle: "Theme",
    themeDescription: "Theme description",
    sourceRank: 1,
    productName: "Product 1",
    imageUrl: null,
    mallDomain: null,
    mallName: null,
    mallIconUrl: null,
    salePrice: 10_000,
    originalPrice: null,
  },
];

describe("buildAffiliateStorefront", () => {
  it("sorts hot deals by source rank and popular products by seven-day clicks", () => {
    const data = buildAffiliateStorefront(
      products,
      [
        { productId: "source-1", clicks: 2 },
        { productId: "source-2", clicks: 2 },
        { productId: "source-2", clicks: 3 },
      ],
      "2026-07-12T00:00:00.000Z",
      new Date("2026-07-13T00:00:00.000Z"),
    );

    expect(data.hotdeals.map((item) => item.id)).toEqual([
      "source-1",
      "source-2",
    ]);
    expect(data.popular.map((item) => item.id)).toEqual([
      "source-2",
      "source-1",
    ]);
    expect(data.isStale).toBe(false);
    expect(calculateDiscountRate(25_800, 12_900)).toBe(50);
    expect(calculateDiscountRate(null, 12_900)).toBeNull();
  });

  it("marks the storefront stale when the last successful sync is older than 48 hours", () => {
    const data = buildAffiliateStorefront(
      products,
      [],
      "2026-07-10T23:59:59.999Z",
      new Date("2026-07-13T00:00:00.000Z"),
    );

    expect(data.isStale).toBe(true);
  });

  it("splits seasonal curation from the synced hotdeal feed", () => {
    const data = buildAffiliateStorefront(
      [
        ...products,
        { ...products[0], id: "seasonal-1", sourceType: "seasonal", sourceRank: 0 },
      ],
      [],
      "2026-07-12T00:00:00.000Z",
      new Date("2026-07-13T00:00:00.000Z"),
    );

    expect(data.seasonal.map((item) => item.id)).toEqual(["seasonal-1"]);
    expect(data.hotdeals.map((item) => item.id)).toEqual(["source-1", "source-2"]);
    expect(data.recommended).toEqual([]);
  });
});
