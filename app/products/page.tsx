import type { Metadata } from "next";
import { TrackedBlock } from "@/components/tracked-block";
import {
  isMemeProductActive,
  MEME_PRODUCTS,
  type MemeProduct,
} from "@/lib/meme-commerce";
import { getRequestLocale } from "@/lib/i18n-server";
import { AUDIENCE_LABELS_I18N, localizeProduct, localizeProductCategory, PAGE_COPY } from "@/lib/i18n-pages";

export async function generateMetadata(): Promise<Metadata> {
  const copy = PAGE_COPY[await getRequestLocale()];
  return { title: copy.productTitle, description: copy.productDescription, alternates: { canonical: "/products" } };
}

export const revalidate = 3600;

export default async function ProductsPage() {
  const locale = await getRequestLocale();
  const copy = PAGE_COPY[locale];
  const activeCount = MEME_PRODUCTS.filter((product) => isMemeProductActive(product)).length;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8">
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">{copy.productEyebrow}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">{copy.productTitle}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
          {copy.productIntro}
        </p>
      </header>

      <section
        aria-label={copy.affiliateTitle}
        className="mt-6 rounded-2xl border border-safety-yellow/30 bg-safety-yellow-bg p-4 text-sm leading-relaxed"
      >
        <p className="font-bold text-safety-yellow">{copy.affiliateTitle}</p>
        <p className="mt-1 text-foreground">
          {copy.affiliateBody(activeCount)}
        </p>
      </section>

      <TrackedBlock event="affiliate_click" className="mt-6">
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MEME_PRODUCTS.map((product) => (
            <li key={product.id} className="min-w-0">
              <ProductCard product={product} locale={locale} />
            </li>
          ))}
        </ul>
      </TrackedBlock>
    </main>
  );
}

function ProductCard({ product, locale }: { product: MemeProduct; locale: Awaited<ReturnType<typeof getRequestLocale>> }) {
  const active = isMemeProductActive(product);
  const copy = PAGE_COPY[locale];
  const localized = localizeProduct(product, locale);

  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-accent">{localizeProductCategory(product.category, locale)}</span>
        {product.audiences.map((audience) => (
          <span key={audience} className="rounded-full bg-surface-2 px-2.5 py-1 text-muted">
            {AUDIENCE_LABELS_I18N[locale][audience]}
          </span>
        ))}
      </div>

      <h2 className="mt-3 break-words text-xl font-extrabold leading-snug">{localized.title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{localized.description}</p>

      <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
        <p className="font-bold text-foreground">{copy.adNotice}</p>
        <p className="mt-1 text-muted">{localized.disclosure}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <p className="text-xs text-muted">
          {copy.expires} <time dateTime={product.expiresAt}>{product.expiresAt}</time>
        </p>
        {active ? (
          <a
            href={product.destinationUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            data-campaign-id={product.id}
            className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-bold text-white transition-transform active:scale-[0.97]"
          >
            {copy.check} <span aria-hidden className="ml-1">↗</span>
          </a>
        ) : (
          <span className="inline-flex min-h-11 items-center rounded-full bg-surface-2 px-4 text-sm font-semibold text-muted">
            {copy.ended}
          </span>
        )}
      </div>

      <a
        href={product.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-muted underline underline-offset-4 hover:text-foreground"
      >
        {copy.original}
      </a>
    </article>
  );
}
