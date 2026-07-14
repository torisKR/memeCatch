import type { Metadata } from "next";
import { ProductsPageContent } from "@/components/products-page-content";
import { getAffiliateStorefront } from "@/lib/affiliate/repository.server";
import { PAGE_COPY } from "@/lib/i18n-pages";

/**
 * ISR 로케일 함정 주의: 여기서 getRequestLocale()(=headers())를 읽으면 페이지가
 * 요청-동적(ƒ)으로 강등되어 revalidate가 무의미해지고 매 요청 SSR이 된다.
 * 서버는 DEFAULT_LOCALE(ko) 기준으로만 정적 렌더하고, 사용자 로케일 카피는
 * ProductsPageContent(클라이언트)가 쿠키에서 복원해 표시한다. (app/layout.tsx 참고)
 */
const copy = PAGE_COPY.ko;

export const metadata: Metadata = {
  title: copy.productTitle,
  description: copy.productDescription,
  alternates: { canonical: "/products" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: copy.productTitle,
    description: copy.productDescription,
    url: "/products",
  },
};

export const revalidate = 3600;

export default async function ProductsPage() {
  const storefront = await getAffiliateStorefront();
  // JSON-LD는 로케일 무관 데이터(상품명·가격)만 담아 서버에서 정적 렌더
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: storefront.hotdeals.map((product, index) => {
      const price = product.salePrice;
      return {
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Product",
          name: product.productName,
          ...(product.imageUrl ? { image: product.imageUrl } : {}),
          url: `/go/products/${product.id}`,
          ...(!storefront.isStale && price !== null && price > 0
            ? {
                offers: {
                  "@type": "Offer",
                  price,
                  priceCurrency: "KRW",
                },
              }
            : {}),
        },
      };
    }),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProductsPageContent storefront={storefront} />
    </main>
  );
}
