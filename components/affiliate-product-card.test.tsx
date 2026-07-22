import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { AffiliateProductCard } from "@/components/affiliate-product-card";
import { AffiliateProductGrid } from "@/components/affiliate-product-grid";
import type { AffiliateStorefrontProduct } from "@/lib/affiliate/types";
import type { Locale } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";

const product: AffiliateStorefrontProduct = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  provider: "adpick",
  sourceType: "hotdeal",
  externalKey: "product-key",
  themeCode: "20",
  themeTitle: "실시간 핫딜",
  themeDescription: "현재 판매 가능한 상품",
  sourceRank: 0,
  productName: "테스트 상품",
  imageUrl: "https://img.podgate.com/product.jpg",
  mallDomain: "shop.example.com",
  mallName: "테스트몰",
  mallIconUrl: null,
  salePrice: 12900,
  originalPrice: 25800,
  clickCount7d: 3,
};

describe("AffiliateProductCard", () => {
  it("shows the merchant, truthful prices, disclosure, and internal exit", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductCard locale="ko" product={product} />,
    );

    expect(html).toContain("테스트 상품");
    expect(html).toContain("테스트몰");
    expect(html).toContain("25,800원");
    expect(html).toContain("12,900원");
    expect(html).toContain("50%");
    expect(html).toContain(PAGE_COPY.ko.affiliateBadge);
    expect(html).toContain(PAGE_COPY.ko.liveBadge);
    expect(html).toContain(
      "/go/products/550e8400-e29b-41d4-a716-446655440000",
    );
    expect(html).toContain('rel="sponsored noopener noreferrer"');
    expect(html).toContain(
      `aria-label="${PAGE_COPY.ko.viewProductLabel(product.productName)}"`,
    );
    expect(html).toContain("focus-visible:ring-inset");
  });

  it("directs shoppers to verify a missing price without inventing a discount", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductCard
        locale="ko"
        product={{ ...product, salePrice: null, originalPrice: null }}
      />,
    );

    expect(html).toContain("판매처에서 가격 확인");
    expect(html).not.toContain("50%");
  });

  it("shows both reported prices without inventing a discount rate", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductCard
        locale="ko"
        product={{ ...product, salePrice: 12900, originalPrice: 12000 }}
      />,
    );

    expect(html).toContain("12,000원");
    expect(html).toContain("12,900원");
    expect(html).not.toContain("50%");
  });

  it("treats an original-only price as reference instead of a current price", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductCard
        locale="ko"
        product={{ ...product, salePrice: null, originalPrice: 25800 }}
      />,
    );

    expect(html).toContain("판매처에서 가격 확인");
    expect(html).toContain("정상가");
    expect(html).toContain("25,800원");
  });

  it("does not present a theme title as the merchant", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductCard
        locale="ko"
        product={{ ...product, mallName: null, mallDomain: null }}
      />,
    );

    expect(html).not.toContain("실시간 핫딜");
  });

  it("keeps remote product image loading explicit and private", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductCard locale="ko" product={product} />,
    );

    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('referrerPolicy="no-referrer"');
  });

  it("keeps the source product name unchanged in every locale", () => {
    for (const locale of ["ko", "en", "ja", "zh"] satisfies Locale[]) {
      const html = renderToStaticMarkup(
        <AffiliateProductCard locale={locale} product={product} />,
      );
      expect(html).toContain("테스트 상품");
    }
  });
});

describe("AffiliateProductGrid", () => {
  it("renders popular products only when present and before hotdeals", () => {
    const withoutPopular = renderToStaticMarkup(
      <AffiliateProductGrid
        locale="ko"
        data={{
          hotdeals: [product],
          recommended: [],
          popular: [],
          lastSuccessfulSyncAt: "2026-07-13T00:00:00.000Z",
          isStale: false,
        }}
      />,
    );
    expect(withoutPopular).not.toContain(PAGE_COPY.ko.popularTitle);
    expect(withoutPopular).toContain(PAGE_COPY.ko.liveAdTitle);

    const withPopular = renderToStaticMarkup(
      <AffiliateProductGrid
        locale="ko"
        data={{
          hotdeals: [product],
          recommended: [],
          popular: [product],
          lastSuccessfulSyncAt: "2026-07-13T00:00:00.000Z",
          isStale: false,
        }}
      />,
    );
    expect(withPopular.indexOf(PAGE_COPY.ko.popularTitle)).toBeLessThan(
      withPopular.indexOf(PAGE_COPY.ko.liveAdTitle),
    );
  });

  it("always renders hotdeals with empty guidance", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductGrid
        locale="ko"
        data={{
          hotdeals: [],
          recommended: [],
          popular: [],
          lastSuccessfulSyncAt: null,
          isStale: false,
        }}
      />,
    );

    expect(html).toContain(PAGE_COPY.ko.liveAdTitle);
    expect(html).toContain(PAGE_COPY.ko.emptyHotdeals);
  });

  it("renders stale guidance with accessible foreground contrast", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductGrid
        locale="ko"
        data={{
          hotdeals: [product],
          recommended: [],
          popular: [],
          lastSuccessfulSyncAt: "2026-07-01T00:00:00.000Z",
          isStale: true,
        }}
      />,
    );

    expect(html).toContain(PAGE_COPY.ko.staleWarning);
    expect(html).toContain("text-foreground");
    expect(html).not.toContain("text-safety-yellow");
  });

  it("removes the carousel edge fade while focus is inside", () => {
    const html = renderToStaticMarkup(
      <AffiliateProductGrid
        locale="ko"
        data={{
          hotdeals: [product],
          recommended: [],
          popular: [],
          lastSuccessfulSyncAt: null,
          isStale: false,
        }}
      />,
    );
    const css = readFileSync("app/globals.css", "utf8");

    expect(html).toContain("shop-carousel-edges");
    expect(css).toMatch(
      /\.shop-carousel-edges:focus-within \[data-slot="carousel-content"\] \{[\s\S]*?-webkit-mask-image: none;[\s\S]*?mask-image: none;/,
    );
  });
});
