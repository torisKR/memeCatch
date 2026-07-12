import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AffiliateProductCard } from "@/components/affiliate-product-card";
import type { AffiliateStorefrontProduct } from "@/lib/affiliate/types";

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
    expect(html).toContain("광고·제휴");
    expect(html).toContain(
      "/go/products/550e8400-e29b-41d4-a716-446655440000",
    );
    expect(html).toContain('rel="sponsored noopener noreferrer"');
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
});
