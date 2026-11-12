import { CategoryTag } from "@/components/category-tag";
import { CountryFlagBadge } from "@/components/country-flag-badge";
import { SafetyBadge } from "@/components/safety-badge";
import { buttonVariants } from "@/components/ui/button";
import { memePathFrom } from "@/lib/labels";
import { originCountryCode } from "@/lib/meme-country";
import type { RetiredProductLocale } from "@/lib/retired-products";
import type { MemeListItem } from "@/lib/queries";
import { cn } from "@/lib/utils";

const COPY = {
  ko: {
    message: "밈상품 페이지는 더 이상 운영하지 않아요.",
    explore: "밈 탐색",
    exploreHref: "/explore",
    popular: "지금 많이 보는 밈",
  },
  en: {
    message: "Meme product pages are no longer available.",
    explore: "Explore memes",
    exploreHref: "/en/explore",
    popular: "Popular memes",
  },
} as const satisfies Record<
  RetiredProductLocale,
  {
    message: string;
    explore: string;
    exploreHref: string;
    popular: string;
  }
>;

/**
 * Same frame as MemeCard at 4:3 with 16px corners. The tombstone is rendered
 * from proxy, which cannot call client components, so this card stays on the server.
 */
function RetiredProductCard({
  meme,
  locale,
}: {
  meme: MemeListItem;
  locale: RetiredProductLocale;
}) {
  const contents = meme.meme_contents ?? [];
  const thumb =
    contents.find((content) => content.is_representative && content.thumbnail_url)
      ?.thumbnail_url ??
    contents.find((content) => content.thumbnail_url)?.thumbnail_url ??
    null;
  const countryCode = originCountryCode(meme.meme_market_profiles);

  return (
    <a
      href={memePathFrom(meme.short_id, meme.slug)}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-surface-2">
        {thumb ? (
          <div
            aria-hidden
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(thumb)})` }}
          />
        ) : (
          <div
            aria-hidden
            className="instrument-grid flex h-full w-full flex-col justify-end gap-2 p-3.5"
            style={{
              background: `var(--cat-${meme.category}-bg)`,
              color: `var(--cat-${meme.category}-text)`,
            }}
          >
            <span className="line-clamp-3 text-xl font-extrabold leading-snug">{meme.title}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <CategoryTag category={meme.category} className="shadow-sm" />
          <CountryFlagBadge code={countryCode} locale={locale} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
        <p title={meme.title} className="line-clamp-2 min-h-[2.75em] break-keep text-lg font-extrabold leading-snug">
          {meme.title}
        </p>
        <p className="line-clamp-2 min-h-[3.25em] break-keep text-sm leading-relaxed text-muted">
          {meme.summary}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border pt-2.5">
          <SafetyBadge level={meme.safety_level} locale={locale} />
        </div>
      </div>
    </a>
  );
}

export function RetiredProductsPage({
  locale,
  memes,
}: {
  locale: RetiredProductLocale;
  memes: MemeListItem[];
}) {
  const copy = COPY[locale];
  const cards = memes.slice(0, 4);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-20">
      <meta name="robots" content="noindex, follow" />
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <h1 className="text-balance text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
          {copy.message}
        </h1>
        <a
          href={copy.exploreHref}
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-6 rounded-xl bg-accent-strong font-bold text-white hover:bg-accent-strong/90",
          )}
        >
          {copy.explore}
        </a>
      </div>
      {cards.length > 0 ? (
        <section className="mt-12" aria-label={copy.popular}>
          <ul className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((meme) => (
              <li key={meme.id} className="min-w-0">
                <RetiredProductCard meme={meme} locale={locale} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
