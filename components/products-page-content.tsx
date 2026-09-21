"use client";

import { AffiliateProductGrid } from "@/components/affiliate-product-grid";
import { EditorialProductCard } from "@/components/editorial-product-card";
import { TrackedBlock } from "@/components/tracked-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { AffiliateStorefrontData } from "@/lib/affiliate/types";
import { useLocale } from "@/lib/i18n-client";
import { PAGE_COPY } from "@/lib/i18n-pages";
import { isMemeProductActive, MEME_PRODUCTS } from "@/lib/meme-commerce";

/**
 * /products 본문 — 로케일 의존 카피(PAGE_COPY)를 클라이언트로 분리한 컴포넌트.
 * 서버 페이지(app/products/page.tsx)는 ko 기준 정적(ISR) HTML만 만들고, 사용자
 * 로케일은 useLocale()(쿠키 useSyncExternalStore 복원)로 여기서 표시한다.
 * 데이터(스토어프론트)는 서버에서 props로 받는다. 언어 선택기 전환 시 즉시 리렌더.
 *
 * 헤더 톤: 편집숍 스티커 컨셉은 유지하되 네오브루탈 강도(border-2 +
 * 하드 섀도우)를 낮춰 사이트 공통 디자인 언어(border/rounded-2xl/shadow-sm~md)에
 * 맞췄다. .shop-sticker(회전 모션)는 globals.css 그대로 재사용.
 */
export function ProductsPageContent({
  storefront,
}: {
  storefront: AffiliateStorefrontData;
}) {
  const { locale } = useLocale();
  const copy = PAGE_COPY[locale];
  // 만료(expiresAt 경과)된 에디터 픽은 렌더링 자체를 생략 — "종료" 카드 노출 금지
  const activeEditorial = MEME_PRODUCTS.filter((product) =>
    isMemeProductActive(product),
  );
  const availableLinkCount =
    storefront.hotdeals.length +
    storefront.recommended.length +
    activeEditorial.length;

  return (
    <>
      <header className="instrument-grid max-w-4xl rounded-2xl border border-border bg-cream p-6 shadow-md sm:p-9">
        <Badge className="shop-sticker border-border bg-surface text-foreground shadow-sm">
          {copy.productEyebrow}
        </Badge>
        <h1 className="mt-5 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
          {copy.shopTitle}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          {copy.shopIntro}
        </p>
      </header>

      <Alert
        aria-label={copy.affiliateTitle}
        className="mt-7 border border-border bg-safety-yellow-bg shadow-sm"
      >
        <AlertTitle className="line-clamp-none font-extrabold text-foreground">
          {copy.affiliateTitle}
        </AlertTitle>
        <AlertDescription className="text-foreground">
          <p>{copy.affiliateBody(availableLinkCount)}</p>
        </AlertDescription>
      </Alert>

      <AffiliateProductGrid data={storefront} locale={locale} />

      {/* 에디터 픽 — 활성 상품만 노출, 전부 만료면 섹션 자체를 숨긴다 */}
      {activeEditorial.length > 0 && (
        <section className="mt-16" aria-labelledby="editor-picks-title">
          <div className="max-w-2xl">
            <h2 id="editor-picks-title" className="text-2xl font-extrabold tracking-tight">
              {copy.editorPickTitle}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {copy.editorPickDescription}
            </p>
          </div>
          <TrackedBlock event="affiliate_click" className="mt-4">
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeEditorial.map((product) => (
                <li key={product.id} className="min-w-0">
                  <EditorialProductCard product={product} locale={locale} />
                </li>
              ))}
            </ul>
          </TrackedBlock>
        </section>
      )}
    </>
  );
}
