import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Locale } from "@/lib/i18n";
import {
  isMemeProductActive,
  type MemeProduct,
} from "@/lib/meme-commerce";
import {
  AUDIENCE_LABELS_I18N,
  localizeProduct,
  localizeProductCategory,
  PAGE_COPY,
} from "@/lib/i18n-pages";
import { cn } from "@/lib/utils";

export function EditorialProductCard({
  product,
  locale,
}: {
  product: MemeProduct;
  locale: Locale;
}) {
  const active = isMemeProductActive(product);
  const copy = PAGE_COPY[locale];
  const localized = localizeProduct(product, locale);

  return (
    <article className="product-sticker-card shop-focus-safe h-full min-w-0">
      <Card className="h-full min-w-0 gap-0 border-2 border-foreground p-5 shadow-[4px_4px_0_var(--foreground)]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge className="shop-sticker min-w-0 whitespace-normal break-words border-foreground bg-cream text-foreground shadow-[2px_2px_0_var(--foreground)]">
            {copy.editorBadge}
          </Badge>
          <Badge variant="outline" className="min-w-0 whitespace-normal break-words">
            {copy.affiliateBadge}
          </Badge>
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold">
          <Badge className="min-w-0 whitespace-normal break-words">
            {localizeProductCategory(product.category, locale)}
          </Badge>
          {product.audiences.map((audience) => (
            <Badge
              key={audience}
              variant="outline"
              className="min-w-0 whitespace-normal break-words"
            >
              {AUDIENCE_LABELS_I18N[locale][audience]}
            </Badge>
          ))}
        </div>

        <h3 className="mt-3 min-w-0 break-words text-xl font-extrabold leading-snug">
          {localized.title}
        </h3>
        <p className="mt-2 min-w-0 flex-1 break-words text-sm leading-relaxed text-muted">
          {localized.description}
        </p>

        <div className="mt-4 min-w-0 rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">
          <p className="min-w-0 break-words font-bold text-foreground">
            {copy.adNotice}
          </p>
          <p className="mt-1 min-w-0 break-words text-muted">
            {localized.disclosure}
          </p>
        </div>

        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="min-w-0 break-words font-mono text-xs text-muted">
            {copy.expires}{" "}
            <time dateTime={product.expiresAt}>{product.expiresAt}</time>
          </p>
          {active ? (
            <a
              href={product.destinationUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              aria-label={copy.checkProductLabel(localized.title)}
              data-campaign-id={product.id}
              className={cn(
                buttonVariants(),
                "min-h-11 min-w-0 max-w-full shrink whitespace-normal break-words rounded-lg bg-ink px-4 text-center font-bold text-white hover:bg-flame-700 focus-visible:ring-flame-500",
              )}
            >
              {copy.check}{" "}
              <span aria-hidden="true">↗</span>
            </a>
          ) : (
            <span className="inline-flex min-h-11 min-w-0 items-center break-words rounded-lg bg-surface-2 px-4 text-sm font-semibold text-muted">
              {copy.ended}
            </span>
          )}
        </div>

        <a
          href={product.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 min-w-0 items-center break-words text-xs font-medium text-muted underline underline-offset-4 hover:text-foreground"
        >
          {copy.original}
        </a>
      </Card>
    </article>
  );
}
