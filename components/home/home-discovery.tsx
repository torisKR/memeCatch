"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import styles from "@/components/home/home-discovery.module.css";
import type { HomeEntry } from "@/components/home/home-experience";
import { MemeCard } from "@/components/meme-card";
import { HOME_DISCOVERY_COPY } from "@/lib/home-discovery-copy";
import { localizedPath, type SeoRouteLocale } from "@/lib/i18n-routing";

type HomeDiscoveryProps = {
  locale: SeoRouteLocale;
  entries: readonly HomeEntry[];
};

type IndexedEntry = {
  entry: HomeEntry;
  position: number;
};

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().trim();
}

function entrySearchText(entry: HomeEntry): string {
  return normalizeSearchText([
    entry.title,
    entry.summary,
    entry.categoryLabel,
    entry.originalTitle ?? "",
  ].join(" "));
}

function discoveryRevision(locale: SeoRouteLocale, entries: readonly HomeEntry[]): string {
  return JSON.stringify([
    locale,
    entries.map((entry) => [
      entry.id,
      entry.href,
      entry.title,
      entry.summary,
      entry.categoryLabel,
      entry.category,
      entry.thumbnailUrl,
      entry.originalTitle,
      entry.safetyLevel,
    ]),
  ]);
}

function HomeDiscoveryDeck({ locale, entries }: HomeDiscoveryProps) {
  const copy = HOME_DISCOVERY_COPY[locale];
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const categories = useMemo(
    () => [...new Set(entries.map((entry) => entry.categoryLabel))],
    [entries],
  );
  const normalizedQuery = normalizeSearchText(query);
  const archiveQuery = query.normalize("NFKC").trim();
  const searchPath = localizedPath("/search", locale);
  const archiveHref = `${searchPath}?${new URLSearchParams({ q: archiveQuery })}`;
  const filteredEntries = useMemo<IndexedEntry[]>(() => entries
    .map((entry, position) => ({ entry, position }))
    .filter(({ entry }) => {
      const matchesCategory = category === null || entry.categoryLabel === category;
      const matchesQuery = normalizedQuery === "" || entrySearchText(entry).includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    }), [category, entries, normalizedQuery]);
  const preview = filteredEntries.length > 0
    ? filteredEntries[previewIndex % filteredEntries.length]
    : undefined;
  const titleId = `home-discovery-title-${locale}`;
  const scopeId = `home-discovery-scope-${locale}`;

  function selectCategory(nextCategory: string | null) {
    setCategory(nextCategory);
    setPreviewIndex(0);
  }

  function clearFilters() {
    setQuery("");
    setCategory(null);
    setPreviewIndex(0);
  }

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <div className={styles.headingGrid}>
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 id={titleId} className={styles.title}>{copy.title}</h2>
        </div>
        <p className={styles.description}>{copy.description}</p>
      </div>

      {entries.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyMark} aria-hidden>00</span>
          <div>
            <h3>{copy.emptyTitle}</h3>
            <p>{copy.emptyDescription}</p>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.tools}>
            <form className={styles.searchArea} role="search" aria-label={copy.searchLabel} action={searchPath} method="get">
              <label className={styles.searchLabel} htmlFor={`home-discovery-search-${locale}`}>
                {copy.searchLabel}
              </label>
              <input
                id={`home-discovery-search-${locale}`}
                className={styles.searchInput}
                type="search"
                name="q"
                maxLength={120}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPreviewIndex(0);
                }}
                placeholder={copy.searchPlaceholder}
                autoComplete="off"
                aria-describedby={scopeId}
              />
              <p id={scopeId} className={styles.searchScope}>{copy.searchScope}</p>
              {archiveQuery ? (
                <Link className={styles.searchArchive} href={archiveHref} prefetch={false}>
                  {copy.searchArchive(archiveQuery)} <span aria-hidden>↗</span>
                </Link>
              ) : null}
            </form>

            <div className={styles.categoryArea}>
              <p className={styles.categoryHeading}>{copy.categoryLabel}</p>
              <div className={styles.chips} role="group" aria-label={copy.categoryLabel}>
                <button
                  type="button"
                  className={styles.chip}
                  aria-pressed={category === null}
                  onClick={() => selectCategory(null)}
                >
                  {copy.allCategories}
                </button>
                {categories.map((categoryLabel) => (
                  <button
                    key={categoryLabel}
                    type="button"
                    className={styles.chip}
                    aria-pressed={category === categoryLabel}
                    onClick={() => selectCategory(categoryLabel)}
                  >
                    {categoryLabel}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className={styles.resultStatus} role="status" aria-live="polite">
            {copy.resultStatus(filteredEntries.length, entries.length)}
          </p>

          {filteredEntries.length > 0 ? (
            <div className={styles.contentGrid}>
              <ol className={styles.deck} aria-label={copy.resultsLabel}>
                {filteredEntries.map(({ entry }, index) => (
                  <li className="min-w-0" key={entry.id}>
                    <MemeCard
                      meme={{
                        short_id: entry.id,
                        slug: "home",
                        title: entry.title,
                        summary: entry.summary,
                        category: entry.category ?? "phrase",
                        safety_level: entry.safetyLevel,
                        origin_year: entry.originYear ?? null,
                        meme_contents: entry.thumbnailUrl
                          ? [{ thumbnail_url: entry.thumbnailUrl, is_representative: true }]
                          : [],
                      }}
                      href={entry.href}
                      locale={locale}
                      priority={index < 2}
                    />
                  </li>
                ))}
              </ol>

              {preview ? (
                <aside className={styles.preview} aria-label={copy.previewLabel}>
                  <div className={styles.previewHeader}>
                    <p className={styles.previewEyebrow}>{copy.previewEyebrow}</p>
                    <span aria-hidden>{String((previewIndex % filteredEntries.length) + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{copy.previewTitle}</h3>
                  <p className={styles.previewDescription}>{copy.previewDescription}</p>
                  <div className={styles.previewRecord}>
                    <span>{preview.entry.categoryLabel}</span>
                    <strong>{preview.entry.title}</strong>
                    {preview.entry.originalTitle ? (
                      <span>
                        {copy.originalLabel} <span lang="ko">{preview.entry.originalTitle}</span>
                      </span>
                    ) : null}
                  </div>
                  <Link
                    className={styles.previewLink}
                    href={preview.entry.href}
                    aria-label={`${copy.previewAction}: ${preview.entry.title}`}
                  >
                    {copy.previewAction} <span aria-hidden>↗</span>
                  </Link>
                  <button
                    type="button"
                    className={styles.nextButton}
                    disabled={filteredEntries.length < 2}
                    onClick={() => setPreviewIndex((current) => (
                      (current + 1) % filteredEntries.length
                    ))}
                  >
                    {copy.nextPreview} <span aria-hidden>→</span>
                  </button>
                </aside>
              ) : null}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span className={styles.emptyMark} aria-hidden>00</span>
              <div>
                <h3>{copy.noResultsTitle}</h3>
                <p>{copy.noResultsDescription}</p>
                <button type="button" className={styles.clearButton} onClick={clearFilters}>
                  {copy.clearFilters}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function HomeDiscovery({ locale, entries }: HomeDiscoveryProps) {
  return (
    <HomeDiscoveryDeck
      key={discoveryRevision(locale, entries)}
      locale={locale}
      entries={entries}
    />
  );
}
