import { AffiliateProductImage } from "@/components/affiliate-product-image";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { calculateDiscountRate } from "@/lib/affiliate/storefront";
import type { AffiliateStorefrontProduct } from "@/lib/affiliate/types";
import { toBcp47, type Locale } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";
import { cn } from "@/lib/utils";

function formatPrice(price: number, locale: Locale): string {
  const amount = new Intl.NumberFormat(toBcp47(locale), {
    maximumFractionDigits: 0,
  }).format(price);

  if (locale === "ko") return `${amount}원`;
  if (locale === "ja") return `${amount}ウォン`;
  if (locale === "zh") return `${amount}韩元`;
  if (locale === "zh-tw") return `${amount}韓元`;
  return `₩${amount}`;
}

export function AffiliateProductCard({
  product,
  locale,
}: {
  product: AffiliateStorefrontProduct;
  locale: Locale;
}) {
  const copy = PAGE_COPY[locale];
  const discountRate = calculateDiscountRate(
    product.originalPrice,
    product.salePrice,
  );
  const merchant = product.mallName || product.mallDomain;

  return (
    <article className="product-sticker-card shop-focus-safe h-full min-w-0">
      <Card className="h-full min-w-0 gap-0 border-2 border-foreground py-0 shadow-[4px_4px_0_var(--foreground)]">
        <div className="relative overflow-hidden rounded-t-[10px]">
          <AffiliateProductImage
            imageUrl={product.imageUrl}
            productName={product.productName}
          />
          <div className="absolute left-3 top-3 flex max-w-[calc(100%_-_1.5rem)] flex-wrap items-center gap-1.5">
            <Badge className="shop-sticker border-foreground bg-cream text-foreground shadow-[2px_2px_0_var(--foreground)]">
              {copy.affiliateBadge}
            </Badge>
            {/* 피드별 배지 — 핫딜은 실시간 광고, 쇼핑메이트 추천은 추천 라벨 */}
            <Badge variant="secondary">
              {product.sourceType === "recommend" ? copy.recommendBadge : copy.liveBadge}
            </Badge>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
          <h3 className="line-clamp-2 min-w-0 break-words text-lg font-extrabold leading-snug">
            {product.productName}
          </h3>

          <div className="mt-4 min-w-0 rounded-xl border border-border bg-surface-2 p-3 font-mono">
            {merchant ? (
              <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                {merchant}
              </p>
            ) : null}
            {product.salePrice !== null ? (
              <div className="mt-2 min-w-0">
                {product.originalPrice !== null ? (
                  <p className="min-w-0 break-words text-xs text-muted">
                    {copy.originalPrice}{" "}
                    <span className={discountRate !== null ? "line-through" : undefined}>
                      {formatPrice(product.originalPrice, locale)}
                    </span>
                  </p>
                ) : null}
                <div className="mt-0.5 flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1">
                  {discountRate !== null ? (
                    <span className="text-lg font-black text-accent-text">
                      {discountRate}%
                    </span>
                  ) : null}
                  <strong className="min-w-0 break-words text-xl font-black tracking-tight">
                    {formatPrice(product.salePrice, locale)}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="mt-2 min-w-0">
                <p className="min-w-0 break-words text-sm font-bold text-foreground">
                  {copy.priceAtMerchant}
                </p>
                {product.originalPrice !== null ? (
                  <p className="mt-1 min-w-0 break-words text-xs text-muted">
                    {copy.originalPrice}{" "}
                    {formatPrice(product.originalPrice, locale)}
                  </p>
                ) : null}
              </div>
            )}
            <p className="mt-1 min-w-0 break-words text-xs leading-relaxed text-muted">
              {copy.merchantPriceNotice}
            </p>
          </div>

          <div className="mt-auto min-w-0 pt-4">
            <a
              href={`/go/products/${product.id}`}
              rel="sponsored noopener noreferrer"
              aria-label={copy.viewProductLabel(product.productName)}
              data-affiliate-product-id={product.id}
              className={cn(
                buttonVariants(),
                "hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)] min-h-11 w-full whitespace-normal break-words rounded-lg bg-ink px-4 text-center font-bold text-white hover:bg-flame-700 focus-visible:ring-inset focus-visible:ring-flame-500 focus-visible:ring-offset-0",
              )}
            >
              {copy.viewProduct}
            </a>
          </div>
        </div>
      </Card>
    </article>
  );
}
