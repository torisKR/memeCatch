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
import Link from "next/link";
import { CreatorProductCard } from "@/components/creator-products/creator-product-card";
import type { PublicCreatorProduct } from "@/lib/creator-products";

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
  creatorProducts,
  creatorProductsError,
}: {
  storefront: AffiliateStorefrontData;
  creatorProducts: PublicCreatorProduct[];
  creatorProductsError: boolean;
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
    storefront.seasonal.length +
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

      <section className="mt-16" aria-labelledby="creator-products-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <Badge className="border-border bg-accent-soft text-accent-text">크리에이터 마켓</Badge>
            <h2 id="creator-products-title" className="mt-3 text-2xl font-extrabold tracking-tight">크리에이터가 직접 소개하는 밈 상품</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">등록된 상품은 검토 후 공개돼요. 판매와 결제는 각 판매처에서 진행하며 홍보 관계를 카드에 표시해요.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/products/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-4 py-2 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">내 상품 등록하기</Link>
            <Link href="/products/mine" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">내 등록 상품</Link>
          </div>
        </div>
        {creatorProductsError ? <p role="alert" className="mt-5 rounded-xl border border-safety-red bg-safety-red-bg p-4 text-base text-safety-red">크리에이터 상품을 불러오지 못했어요. 잠시 후 다시 확인해 주세요.</p>
          : creatorProducts.length === 0 ? <p className="mt-5 rounded-xl border border-border bg-surface p-6 text-base text-muted">아직 공개된 크리에이터 상품이 없어요. 상품을 등록하고 소개해 보세요.</p>
          : <ul className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{creatorProducts.map((product) => <li key={product.id} className="min-w-0"><CreatorProductCard product={product} /></li>)}</ul>}
      </section>
    </>
  );
}
