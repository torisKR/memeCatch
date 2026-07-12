import { calculateDiscountRate } from "@/lib/affiliate/storefront";
import type { AffiliateStorefrontProduct } from "@/lib/affiliate/types";
import type { Locale } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";

const PRICE_LOCALES: Record<Locale, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
  zh: "zh-CN",
};

function formatPrice(price: number, locale: Locale): string {
  const amount = new Intl.NumberFormat(PRICE_LOCALES[locale], {
    maximumFractionDigits: 0,
  }).format(price);

  if (locale === "ko") return `${amount}원`;
  if (locale === "ja") return `${amount}ウォン`;
  if (locale === "zh") return `${amount}韩元`;
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
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="relative aspect-[4/3] overflow-hidden bg-accent-soft">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt=""
            width={640}
            height={480}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid h-full place-items-center font-mono text-xs font-bold uppercase tracking-[0.16em] text-accent"
          >
            MemeCatch pick
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full border border-accent/20 bg-surface/95 px-2.5 py-1 text-xs font-bold text-accent shadow-sm">
          {copy.affiliateBadge}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="line-clamp-2 text-lg font-extrabold leading-snug">
          {product.productName}
        </h3>

        <div className="mt-4 rounded-xl border border-border bg-surface-2 p-3">
          {merchant ? (
            <p className="truncate font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {merchant}
            </p>
          ) : null}
          {product.salePrice !== null ? (
            <div className="mt-2">
              {product.originalPrice !== null ? (
                <p className="text-xs text-muted">
                  {copy.originalPrice}{" "}
                  <span className={discountRate !== null ? "line-through" : undefined}>
                    {formatPrice(product.originalPrice, locale)}
                  </span>
                </p>
              ) : null}
              <div className="mt-0.5 flex flex-wrap items-end gap-x-2 gap-y-1">
                {discountRate !== null ? (
                  <span className="text-lg font-black text-accent">
                    {discountRate}%
                  </span>
                ) : null}
                <strong className="text-xl font-black tracking-tight">
                  {formatPrice(product.salePrice, locale)}
                </strong>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <p className="text-sm font-bold text-foreground">
                {copy.priceAtMerchant}
              </p>
              {product.originalPrice !== null ? (
                <p className="mt-1 text-xs text-muted">
                  {copy.originalPrice}{" "}
                  {formatPrice(product.originalPrice, locale)}
                </p>
              ) : null}
            </div>
          )}
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {copy.merchantPriceNotice}
          </p>
        </div>

        <div className="mt-4">
          <a
            href={`/go/products/${product.id}`}
            rel="sponsored noopener noreferrer"
            data-affiliate-product-id={product.id}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-4 text-sm font-bold text-white"
          >
            {copy.viewProduct}
          </a>
        </div>
      </div>
    </article>
  );
}
