import { MemeCard } from "@/components/meme-card";
import { buttonVariants } from "@/components/ui/button";
import { localizedMemePath } from "@/lib/i18n-routing";
import type { MemeListItem } from "@/lib/queries";
import type { RetiredProductLocale, RetiredRouteLocale } from "@/lib/retired-products";
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

export function RetiredProductsPage({
  locale,
  routeLocale = locale,
  memes,
}: {
  locale: RetiredProductLocale;
  routeLocale?: RetiredRouteLocale;
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
                <MemeCard
                  meme={meme}
                  href={localizedMemePath(routeLocale, meme.short_id, meme.slug)}
                  locale={routeLocale}
                  imageAspect="4/3"
                  staticMarkup
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
