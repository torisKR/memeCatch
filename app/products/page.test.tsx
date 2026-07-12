import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "ko"),
}));

vi.mock("@/lib/affiliate/repository.server", () => ({
  getAffiliateStorefront: vi.fn(async () => ({
    hotdeals: [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        provider: "adpick",
        sourceType: "hotdeal",
        externalKey: "product-key",
        themeCode: "20",
        themeTitle: "실시간 핫딜",
        themeDescription: "현재 판매 가능한 상품",
        sourceRank: 0,
        productName: "원문 상품명",
        imageUrl: "https://img.podgate.com/product.jpg",
        mallDomain: "shop.example.com",
        mallName: "테스트몰",
        mallIconUrl: null,
        salePrice: 12900,
        originalPrice: 25800,
        clickCount7d: 0,
      },
    ],
    popular: [],
    lastSuccessfulSyncAt: "2026-07-01T00:00:00.000Z",
    isStale: true,
  })),
}));

import ProductsPage from "@/app/products/page";
import { getAffiliateStorefront } from "@/lib/affiliate/repository.server";
import { PAGE_COPY } from "@/lib/i18n-pages";

describe("ProductsPage", () => {
  it("places the hotdeal storefront before legacy offers", async () => {
    const html = renderToStaticMarkup(await ProductsPage());

    expect(html.indexOf(PAGE_COPY.ko.hotdealTitle)).toBeLessThan(
      html.indexOf(PAGE_COPY.ko.legacyOffersTitle),
    );
  });

  it("omits all offer price fields from stale JSON-LD", async () => {
    const html = renderToStaticMarkup(await ProductsPage());
    const script = html.match(
      /<script type="application\/ld\+json">(.+?)<\/script>/,
    )?.[1];

    expect(script).toBeDefined();
    expect(script).not.toContain('"offers"');
    expect(script).not.toContain('"price"');
    expect(script).not.toContain('"priceCurrency"');
  });

  it("does not publish an original-only price as a current JSON-LD offer", async () => {
    vi.mocked(getAffiliateStorefront).mockResolvedValueOnce({
      hotdeals: [
        {
          id: "550e8400-e29b-41d4-a716-446655440000",
          provider: "adpick",
          sourceType: "hotdeal",
          externalKey: "product-key",
          themeCode: "20",
          themeTitle: "실시간 핫딜",
          themeDescription: "현재 판매 가능한 상품",
          sourceRank: 0,
          productName: "원문 상품명",
          imageUrl: "https://img.podgate.com/product.jpg",
          mallDomain: "shop.example.com",
          mallName: "테스트몰",
          mallIconUrl: null,
          salePrice: null,
          originalPrice: 25800,
          clickCount7d: 0,
        },
      ],
      popular: [],
      lastSuccessfulSyncAt: "2026-07-13T00:00:00.000Z",
      isStale: false,
    });

    const html = renderToStaticMarkup(await ProductsPage());
    const script = html.match(
      /<script type="application\/ld\+json">(.+?)<\/script>/,
    )?.[1];

    expect(script).toBeDefined();
    expect(script).not.toContain('"offers"');
    expect(script).not.toContain('"price"');
    expect(script).not.toContain('"priceCurrency"');
  });
});
