import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemeCard } from "@/components/meme-card";
import { MOBILE_CARD_CLEARANCE } from "@/components/mobile-card-clearance";
import { LOCALIZED_EXPLORE_COPY } from "@/lib/i18n-global-explore";
import {
  SEO_LOCALE_CONFIG,
  buildLocalizedMetadata,
  isSeoContentLocale,
  localizedMemePath,
  localizedStaticPath,
} from "@/lib/i18n-routing";
import {
  getLocalizedExploreMemes,
  type LocalizedExploreSort,
} from "@/lib/localized-explore";
import { SITE_URL } from "@/lib/site";

type RawParams = Record<string, string | string[] | undefined>;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
};

function hasQuery(params: RawParams): boolean {
  return Object.values(params).some((value) =>
    Array.isArray(value) ? value.some(Boolean) : Boolean(value),
  );
}

function parseSort(params: RawParams): LocalizedExploreSort | undefined {
  const value = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  return value === "recent" ? "recent" : undefined;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  const query = await searchParams;
  const result = await getLocalizedExploreMemes(locale, parseSort(query));
  const copy = LOCALIZED_EXPLORE_COPY[locale];
  const indexable = result.status === "active" && !hasQuery(query);

  return {
    ...buildLocalizedMetadata({
      locale,
      pathname: "/explore",
      title: copy.title,
      description: copy.description,
    }),
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };
}

function ExploreJsonLd({
  locale,
  name,
  description,
}: {
  locale: string;
  name: string;
  description: string;
}) {
  const url = `${SITE_URL}/${locale}/explore`;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name,
          description,
          url,
          inLanguage: locale,
          isPartOf: { "@type": "WebSite", name: "MemeCatch", url: `${SITE_URL}/${locale}` },
        }).replace(/</g, "\\u003c"),
      }}
    />
  );
}

export default async function LocalizedExplorePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();

  const query = await searchParams;
  const result = await getLocalizedExploreMemes(locale, parseSort(query));
  const copy = LOCALIZED_EXPLORE_COPY[locale];
  const config = SEO_LOCALE_CONFIG[locale];
  const showCards = result.items.length > 0;
  const isIndexable = result.status === "active" && !hasQuery(query);

  return (
    <main
      lang={config.documentLanguage}
      dir={config.direction}
      className="bg-background pb-16 text-foreground"
    >
      {isIndexable && (
        <ExploreJsonLd locale={locale} name={copy.title} description={copy.description} />
      )}
      <section className="border-b border-border px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
            {copy.eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
            {copy.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            {copy.description}
          </p>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            {copy.intro}
          </p>
          <Link
            href={localizedStaticPath("/search", locale)}
            className="mt-7 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {copy.read}
          </Link>
        </div>
      </section>

      <section aria-labelledby="localized-explore-results" className="mx-auto max-w-5xl px-4 py-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="localized-explore-results" className="text-2xl font-black tracking-tight">
              {copy.resultSummary(result.items.length)}
            </h2>
          </div>
          <Link
            href={localizedStaticPath("/", locale)}
            className="text-sm font-semibold text-muted underline decoration-border underline-offset-4 hover:text-accent"
          >
            {copy.home}
          </Link>
        </div>

        {result.status === "unavailable" && (
          <div role="alert" className="mt-6 rounded-2xl border border-border bg-surface p-6">
            <p className="font-bold">{copy.unavailableTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{copy.unavailableDescription}</p>
          </div>
        )}

        {result.status === "coverage-empty" && (
          <div role="status" className="mt-6 rounded-2xl border border-border bg-surface p-6">
            <p className="font-bold">{copy.emptyTitle}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">{copy.emptyDescription}</p>
            <Link
              href="/explore"
              data-localized-explore-original-action
              className="mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
            >
              {copy.originalExplore}
            </Link>
          </div>
        )}

        {showCards && (
          <ul aria-label={copy.title} className={`mt-7 grid grid-cols-2 gap-4 lg:grid-cols-3 ${MOBILE_CARD_CLEARANCE}`}>
            {result.items.map((meme, index) => (
              <li key={meme.id} className="min-w-0">
                <MemeCard
                  meme={meme}
                  href={localizedMemePath(locale, meme.short_id, meme.slug)}
                  locale={locale}
                  priority={index < 6}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
