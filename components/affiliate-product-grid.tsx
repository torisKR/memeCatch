import { AffiliateProductCard } from "@/components/affiliate-product-card";
import { AffiliateProductCarousel } from "@/components/affiliate-product-carousel";
import { TrackedBlock } from "@/components/tracked-block";
import type { AffiliateStorefrontData } from "@/lib/affiliate/types";
import { toBcp47, type Locale } from "@/lib/i18n";
import { PAGE_COPY } from "@/lib/i18n-pages";

export function AffiliateProductGrid({
  data,
  locale,
}: {
  data: AffiliateStorefrontData;
  locale: Locale;
}) {
  const copy = PAGE_COPY[locale];
  const updatedAt = data.lastSuccessfulSyncAt
    ? new Intl.DateTimeFormat(toBcp47(locale), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(new Date(data.lastSuccessfulSyncAt))
    : null;

  return (
    <TrackedBlock event="affiliate_product_click" className="shop-carousel-edges mt-10">
      {updatedAt ? (
        <p className="font-mono text-xs font-semibold text-muted">
          {copy.lastUpdated} <time dateTime={data.lastSuccessfulSyncAt ?? undefined}>{updatedAt}</time>
        </p>
      ) : null}

      {data.isStale ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-safety-yellow/30 bg-safety-yellow-bg px-4 py-3 text-sm font-semibold text-foreground"
        >
          {copy.staleWarning}
        </p>
      ) : null}

      {data.popular.length > 0 ? (
        <StaticProductSection
          sectionId="popular-products"
          className="mt-6"
          title={copy.popularTitle}
          description={copy.popularDescription}
          products={data.popular}
          locale={locale}
        />
      ) : null}

      {/* 쇼핑메이트 추천상품 피드(sdk_shopping.php) — 핫딜과 별도 소스 */}
      {data.recommended.length > 0 ? (
        <StaticProductSection
          sectionId="recommend-products"
          className={data.popular.length > 0 ? "mt-12" : "mt-6"}
          title={copy.recommendTitle}
          description={copy.recommendDescription}
          products={data.recommended}
          locale={locale}
        />
      ) : null}

      <HotdealProductSection
        sectionId="hotdeal-products"
        className={
          data.popular.length > 0 || data.recommended.length > 0
            ? "mt-12"
            : "mt-6"
        }
        title={copy.liveAdTitle}
        description={copy.liveAdDescription}
        products={data.hotdeals}
        locale={locale}
        emptyMessage={copy.emptyHotdeals}
      />
    </TrackedBlock>
  );
}

function StaticProductSection({
  sectionId,
  title,
  description,
  products,
  locale,
  className,
}: {
  sectionId: string;
  title: string;
  description: string;
  products: AffiliateStorefrontData["hotdeals"];
  locale: Locale;
  className: string;
}) {
  return (
    <section className={className} aria-labelledby={`${sectionId}-title`}>
      <div className="max-w-2xl">
        <h2 id={`${sectionId}-title`} className="text-2xl font-extrabold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <li key={product.id} className="min-w-0">
            <AffiliateProductCard product={product} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function HotdealProductSection({
  sectionId,
  title,
  description,
  products,
  locale,
  className,
  emptyMessage,
}: {
  sectionId: string;
  title: string;
  description: string;
  products: AffiliateStorefrontData["hotdeals"];
  locale: Locale;
  className: string;
  emptyMessage: string;
}) {
  return (
    <section className={className} aria-labelledby={`${sectionId}-title`}>
      <div className="max-w-2xl">
        <h2 id={`${sectionId}-title`} className="text-2xl font-extrabold tracking-tight">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
      </div>

      {products.length > 0 ? (
        <AffiliateProductCarousel
          products={products}
          locale={locale}
          sectionId={sectionId}
        />
      ) : (
        <p className="mt-4 rounded-2xl border border-border bg-surface-2 p-5 text-sm leading-relaxed text-muted">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}
