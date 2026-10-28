import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const commerceFixture = vi.hoisted(() => ({
  products: [
    {
      id: "active-editorial-campaign",
      title: "활성 에디터 캠페인",
      description: "활성 캠페인 설명",
      category: "크리에이터",
      audiences: ["20s"],
      provider: "adpick",
      status: "approved",
      destinationUrl: "https://deg.kr/active",
      sourceUrl: "https://adpick.co.kr/?ac=offer&offer=active",
      disclosure: "활성 캠페인 광고 고지",
      approvedAt: "2000-01-01",
      expiresAt: "2999-12-31",
    },
    {
      id: "expired-editorial-campaign",
      title: "만료 에디터 캠페인",
      description: "만료 캠페인 설명",
      category: "학습",
      audiences: ["40s"],
      provider: "adpick",
      status: "approved",
      destinationUrl: "https://deg.kr/expired",
      sourceUrl: "https://adpick.co.kr/?ac=offer&offer=expired",
      disclosure: "만료 캠페인 광고 고지",
      approvedAt: "2000-01-01",
      expiresAt: "2000-01-02",
    },
  ],
}));

vi.mock("@/lib/meme-commerce", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meme-commerce")>();
  return { ...actual, MEME_PRODUCTS: commerceFixture.products };
});

vi.mock("@/lib/affiliate/repository.server", () => ({
  getAffiliateStorefront: vi.fn(async () => ({
    recommended: [],
    seasonal: [],
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
vi.mock("@/lib/creator-products/server", () => ({
  getPublicCreatorProducts: vi.fn(async () => ({ products: [], error: false })),
}));

import ProductsPage from "@/app/(default)/products/page";
import { getAffiliateStorefront } from "@/lib/affiliate/repository.server";
import { getPublicCreatorProducts } from "@/lib/creator-products/server";
import { LocaleProvider } from "@/lib/i18n-client";
import { isMemeProductActive, MEME_PRODUCTS } from "@/lib/meme-commerce";
import { PAGE_COPY } from "@/lib/i18n-pages";

// M10: 페이지는 더 이상 getRequestLocale()을 읽지 않는다(ISR 유지 — ko 정적 렌더).
// 로케일 카피는 ProductsPageContent(클라이언트)가 useLocale()로 표시하므로,
// 서버 렌더 검증 시 LocaleProvider(initialLocale="ko")로 감싼다.
async function renderProductsPage() {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale="ko">{await ProductsPage()}</LocaleProvider>,
  );
}

describe("ProductsPage", () => {
  it("renders the editorial shop hierarchy and truthful available-link count", async () => {
    const html = await renderProductsPage();
    const activeMemeProductCount = MEME_PRODUCTS.filter((product) =>
      isMemeProductActive(product),
    ).length;

    expect(MEME_PRODUCTS).toHaveLength(2);
    expect(activeMemeProductCount).toBe(1);
    expect(html).toContain(PAGE_COPY.ko.shopTitle);
    expect(html.indexOf(PAGE_COPY.ko.liveAdTitle)).toBeLessThan(
      html.indexOf(PAGE_COPY.ko.editorPickTitle),
    );
    expect(html).toContain(
      PAGE_COPY.ko.affiliateBody(1 + activeMemeProductCount),
    );
    expect(html).not.toContain(PAGE_COPY.ko.affiliateBody(1 + MEME_PRODUCTS.length));
    expect(html).toContain("bg-cream");
  });

  it("omits all offer price fields from stale JSON-LD", async () => {
    const html = await renderProductsPage();
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
      recommended: [],
      seasonal: [],
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

    const html = await renderProductsPage();
    const script = html.match(
      /<script type="application\/ld\+json">(.+?)<\/script>/,
    )?.[1];

    expect(script).toBeDefined();
    expect(script).not.toContain('"offers"');
    expect(script).not.toContain('"price"');
    expect(script).not.toContain('"priceCurrency"');
  });

  it("keeps creator promotions visibly separate and labels the external seller relationship", async () => {
    vi.mocked(getPublicCreatorProducts).mockResolvedValueOnce({
      products: [{
        id: "creator-product-1",
        title: "밈 티셔츠",
        description: "크리에이터가 직접 디자인한 상품입니다.",
        external_url: "https://shop.example.com/meme-shirt",
        image_path: "creator-products/user-id/image.png",
        price: null,
        category: "apparel",
        relationship_disclosure: "creator",
      }],
      error: false,
    });

    const html = await renderProductsPage();
    expect(html).toContain("크리에이터 마켓");
    expect(html).toContain("크리에이터가 직접 소개하는 밈 상품");
    expect(html).toContain("크리에이터 홍보");
    expect(html).toContain("크리에이터 제작");
    expect(html).toContain("https://shop.example.com/meme-shirt");
    expect(html).toContain("rel=\"sponsored noopener noreferrer\"");
  });
});
