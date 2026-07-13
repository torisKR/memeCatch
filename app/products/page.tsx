import type { Metadata } from "next";
import { AffiliateProductGrid } from "@/components/affiliate-product-grid";
import { EditorialProductCard } from "@/components/editorial-product-card";
import { TrackedBlock } from "@/components/tracked-block";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getAffiliateStorefront } from "@/lib/affiliate/repository.server";
import { isMemeProductActive, MEME_PRODUCTS } from "@/lib/meme-commerce";
import { getRequestLocale } from "@/lib/i18n-server";
import { PAGE_COPY } from "@/lib/i18n-pages";

export async function generateMetadata(): Promise<Metadata> {
  const copy = PAGE_COPY[await getRequestLocale()];
  return { title: copy.productTitle, description: copy.productDescription, alternates: { canonical: "/products" } };
}

export const revalidate = 3600;

export default async function ProductsPage() {
  const [locale, storefront] = await Promise.all([
    getRequestLocale(),
    getAffiliateStorefront(),
  ]);
  const copy = PAGE_COPY[locale];
  const activeEditorialCount = MEME_PRODUCTS.filter((product) =>
    isMemeProductActive(product),
  ).length;
  const availableLinkCount = storefront.hotdeals.length + activeEditorialCount;
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
      <header className="max-w-4xl rounded-[1.75rem] border-2 border-foreground bg-cream p-6 shadow-[6px_6px_0_var(--foreground)] sm:p-9">
        <Badge className="shop-sticker border-foreground bg-surface text-foreground shadow-[2px_2px_0_var(--foreground)]">
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
        className="mt-7 border-2 border-foreground bg-safety-yellow-bg shadow-[3px_3px_0_var(--foreground)]"
      >
        <AlertTitle className="line-clamp-none font-extrabold text-foreground">
          {copy.affiliateTitle}
        </AlertTitle>
        <AlertDescription className="text-foreground">
          <p>{copy.affiliateBody(availableLinkCount)}</p>
        </AlertDescription>
      </Alert>

      <AffiliateProductGrid data={storefront} locale={locale} />

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
            {MEME_PRODUCTS.map((product) => (
              <li key={product.id} className="min-w-0">
                <EditorialProductCard product={product} locale={locale} />
              </li>
            ))}
          </ul>
        </TrackedBlock>
      </section>
    </main>
  );
}
