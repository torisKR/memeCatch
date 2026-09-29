import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemeCard } from "@/components/meme-card";
import { SearchOutcomeTracker } from "@/components/search-outcome-tracker";
import { StatusPanel } from "@/components/status-panel";
import { TrackedBlock } from "@/components/tracked-block";
import { LOCALIZED_EXPLORE_COPY } from "@/lib/i18n-global-explore";
import { GLOBAL_SEARCH_COPY } from "@/lib/i18n-global-search";
import {
  buildLocalizedMetadata,
  isSeoContentLocale,
  localizedMemePath,
  localizedStaticPath,
} from "@/lib/i18n-routing";
import { memePathFrom } from "@/lib/labels";
import {
  getLocalizedSearchMemesResult,
  type LocalizedMemeDetail,
} from "@/lib/meme-translations";
import {
  shouldOfferLocalizedSearchRecovery,
  type LocalizedSearchRecoveryStatus,
} from "@/lib/localized-search-recovery";
import { getTrendingMemes, searchMemes, type MemeListItem } from "@/lib/queries";
import { SearchInput } from "@/app/(default)/search/search-input";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  return {
    ...buildLocalizedMetadata({
      locale,
      pathname: "/search",
      title: GLOBAL_SEARCH_COPY[locale].title,
      description: GLOBAL_SEARCH_COPY[locale].description,
    }),
    robots: { index: false, follow: true },
  };
}

export default async function LocalizedSearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const contentLocale = isSeoContentLocale(locale) ? locale : notFound();

  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim();
  const [results, trending] = await Promise.all([
    query ? searchMemes(query) : Promise.resolve([] as MemeListItem[]),
    getTrendingMemes(8),
  ]);
  const localizedSearch = await getLocalizedSearchMemesResult(
    [...results, ...trending].map((meme) => meme.short_id),
    contentLocale,
  );
  const localizedByShortId = localizedSearch.items;
  const copy = GLOBAL_SEARCH_COPY[contentLocale];
  const popularTerms = trending.map((meme) => meme.title);
  const needsFallback = !query || results.length === 0;
  const firstOriginalResult = results[0] ?? null;
  const translationOptionsHref = firstOriginalResult
    ? `${memePathFrom(firstOriginalResult.short_id, firstOriginalResult.slug)}#global-translation-title`
    : null;
  const localizedResultCount = results.reduce(
    (count, meme) => count + (localizedByShortId.has(meme.short_id) ? 1 : 0),
    0,
  );
  const localizedResultStatus: LocalizedSearchRecoveryStatus =
    localizedSearch.status === "unavailable"
      ? "unavailable"
      : localizedResultCount > 0
        ? "active"
        : "coverage-empty";
  const needsOriginalRecovery = shouldOfferLocalizedSearchRecovery({
    query,
    resultCount: results.length,
    localizedResultCount,
    localizedStatus: localizedResultStatus,
  });

  function cardHref(meme: MemeListItem, localized: LocalizedMemeDetail | undefined) {
    return localized
      ? localizedMemePath(contentLocale, localized.short_id, localized.slug)
      : memePathFrom(meme.short_id, meme.slug);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-6">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-(--signal-cyan)">
        {copy.eyebrow}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{copy.title}</h1>
      <p className="mt-1 text-base text-muted">{copy.description}</p>
      <div className="relative mt-5">
        <SearchInput
          initialQuery={query}
          popularTerms={popularTerms}
          searchPath={localizedStaticPath("/search", contentLocale)}
          copy={copy.input}
        />
      </div>

      <SearchOutcomeTracker query={query} resultCount={results.length} />

      {query && results.length > 0 && (
        <section
          aria-label={copy.resultSection}
          className="instrument-grid mt-6 rounded-2xl border border-border/70 p-3"
        >
          <p className="text-base text-muted">{copy.resultSummary(query, results.length)}</p>
          <TrackedBlock event="search_result_click" params={{ query }}>
            <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {results.map((meme) => {
                const localized = localizedByShortId.get(meme.short_id);
                return (
                  <li key={meme.id} className="min-w-0">
                    <div lang={localized ? undefined : "ko"} className="flex h-full flex-col gap-2">
                      {!localized && (
                        <span className="text-xs font-semibold text-muted">{copy.fallbackLabel}</span>
                      )}
                      <MemeCard
                        meme={localized ?? meme}
                        href={cardHref(meme, localized)}
                        locale={contentLocale}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </TrackedBlock>
        </section>
      )}

      {needsOriginalRecovery && (
        <StatusPanel
          className="mt-6"
          role="status"
          tone="waiting"
          art={false}
          label={LOCALIZED_EXPLORE_COPY[contentLocale].eyebrow}
          title={LOCALIZED_EXPLORE_COPY[contentLocale].emptyTitle}
          description={LOCALIZED_EXPLORE_COPY[contentLocale].emptyDescription}
          actions={
            <div className="flex flex-wrap gap-3">
              <Link
                href={localizedStaticPath("/explore", "ko")}
                data-localized-search-original-action
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                {LOCALIZED_EXPLORE_COPY[contentLocale].originalExplore}
              </Link>
              {translationOptionsHref && (
                <Link
                  href={translationOptionsHref}
                  data-localized-search-translation-options-action
                  className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-5 text-sm font-bold text-white transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {copy.translationOptions}
                </Link>
              )}
            </div>
          }
        />
      )}

      {query && results.length === 0 && (
        <StatusPanel
          className="mt-6"
          role="status"
          tone="missing"
          label={copy.noResultLabel}
          title={copy.noResultTitle}
          description={copy.noResultDescription}
          actions={
            <Link
              href={`/submit?name=${encodeURIComponent(query)}`}
              rel="nofollow"
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-[0.97]"
            >
              {copy.submit(query)}
            </Link>
          }
        />
      )}

      {needsFallback && trending.length > 0 && (
        <section aria-labelledby="search-trending" className="mt-8">
          <h2 id="search-trending" className="text-xl font-bold">{copy.trendingTitle}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {trending.slice(0, 6).map((meme) => {
              const localized = localizedByShortId.get(meme.short_id);
              return (
                <li key={meme.id} className="min-w-0">
                  <div lang={localized ? undefined : "ko"} className="flex h-full flex-col gap-2">
                    {!localized && (
                      <span className="text-xs font-semibold text-muted">{copy.fallbackLabel}</span>
                    )}
                    <MemeCard
                      meme={localized ?? meme}
                      href={localized ? localizedMemePath(contentLocale, localized.short_id, localized.slug) : memePathFrom(meme.short_id, meme.slug)}
                      locale={contentLocale}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
