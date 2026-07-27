import type { Metadata } from "next";
import { ProductsPageContent } from "@/components/products-page-content";
import { getAffiliateStorefront } from "@/lib/affiliate/repository.server";
import { PAGE_COPY } from "@/lib/i18n-pages";
import { AdsenseScript } from "@/components/adsense-script";

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
  // JSON-LD — Product/Offer 타입을 쓰지 않는다(의도적). 우리는 판매자가 아닌
  // 제휴 링크 디렉터리라 Google 판매자 목록이 요구하는 gtin·brand·availability·
  // 반품정책·배송정보·리뷰를 정직하게 제공할 수 없고(제3자 판매처 소관),
  // Product+offers로 내보내면 서치콘솔 판매자 목록 오류만 쌓인다.
  // 단순 ItemList(이름+링크)로 강등해 페이지 구조만 기술한다.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "밈 상품 모음",
    // 핫딜 + 쇼핑메이트 추천 두 피드를 하나의 ItemList로 기술
    itemListElement: [...storefront.hotdeals, ...storefront.recommended].map(
      (product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.productName,
        url: `https://catchmeme.com/go/products/${product.id}`,
      }),
    ),
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8">
      <AdsenseScript />
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
