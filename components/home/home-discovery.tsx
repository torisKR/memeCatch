"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { mountCardPointerSurface } from "@/components/home/card-pointer-surface";
import styles from "@/components/home/home-discovery.module.css";
import type { HomeEntry } from "@/components/home/home-experience";
import { SafetyBadge } from "@/components/safety-badge";
import { HOME_DISCOVERY_COPY } from "@/lib/home-discovery-copy";
import type { SeoRouteLocale } from "@/lib/i18n-routing";

type HomeDiscoveryProps = {
  locale: SeoRouteLocale;
  entries: readonly HomeEntry[];
};

type IndexedEntry = {
  entry: HomeEntry;
  position: number;
};

const CARD_ARTWORK_VARIANTS = ["orbit", "cutout", "signal", "frame"] as const;

type CardArtworkVariant = (typeof CARD_ARTWORK_VARIANTS)[number];

function CardArtwork({ variant }: { variant: CardArtworkVariant }) {
  return (
    <span className={styles.cardArtwork} data-card-artwork={variant}>
      <svg viewBox="0 0 320 180" aria-hidden="true" focusable="false">
        {variant === "orbit" ? (
          <>
            <rect className={styles.artIvory} width="320" height="180" />
            <circle className={styles.artOrange} cx="229" cy="70" r="58" />
            <circle className={styles.artOrbit} cx="107" cy="91" r="66" />
            <path className={styles.artInk} d="M0 139 121 59l35 21-85 100H0Z" />
            <rect className={styles.artInk} x="246" y="130" width="74" height="16" />
          </>
        ) : null}
        {variant === "cutout" ? (
          <>
            <rect className={styles.artOrange} width="320" height="180" />
            <path className={styles.artInk} d="M-8 24h184l-52 132H-8Z" />
            <circle className={styles.artIvory} cx="215" cy="91" r="65" />
            <path className={styles.artCut} d="m172 180 63-118 88 83v35Z" />
            <rect className={styles.artIvory} x="26" y="132" width="78" height="13" />
          </>
        ) : null}
        {variant === "signal" ? (
          <>
            <rect className={styles.artInk} width="320" height="180" />
            <rect className={styles.artIvory} x="28" y="25" width="94" height="130" />
            <circle className={styles.artOrange} cx="75" cy="90" r="25" />
            <path className={styles.artSignal} d="M151 45c55 0 55 90 110 90M151 71c34 0 34 38 68 38M151 97c17 0 17-13 34-13" />
            <rect className={styles.artOrange} x="270" y="25" width="22" height="130" />
          </>
        ) : null}
        {variant === "frame" ? (
          <>
            <rect className={styles.artIvory} width="320" height="180" />
            <path className={styles.artOrange} d="M0 0h138L93 180H0Z" />
            <rect className={styles.artFrame} x="122" y="26" width="159" height="128" />
            <circle className={styles.artInk} cx="203" cy="90" r="34" />
            <path className={styles.artIvory} d="m180 91 18-19 28 37h-53Z" />
          </>
        ) : null}
      </svg>
    </span>
  );
}

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
  const deckRef = useRef<HTMLOListElement>(null);
  const categories = useMemo(
    () => [...new Set(entries.map((entry) => entry.categoryLabel))],
    [entries],
  );
  const normalizedQuery = normalizeSearchText(query);
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

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return;
    return mountCardPointerSurface(deck);
  }, [filteredEntries]);

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
            <div className={styles.searchArea} role="search" aria-label={copy.searchLabel}>
              <label className={styles.searchLabel} htmlFor={`home-discovery-search-${locale}`}>
                {copy.searchLabel}
              </label>
              <input
                id={`home-discovery-search-${locale}`}
                className={styles.searchInput}
                type="search"
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
            </div>

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
              <ol ref={deckRef} className={styles.deck} aria-label={copy.resultsLabel}>
                {filteredEntries.map(({ entry, position }) => (
                  <li className={styles.card} key={entry.id}>
                    <Link
                      className={styles.cardLink}
                      href={entry.href}
                      data-interactive-card
                      data-tilt="0,0"
                    >
                      <span className={styles.cardTopline}>
                        <span className={styles.cardNumber} aria-hidden>
                          {String(position + 1).padStart(2, "0")}
                        </span>
                        <span className={styles.categoryBadge}>{entry.categoryLabel}</span>
                        <SafetyBadge level={entry.safetyLevel} locale={locale} />
                      </span>
                      <CardArtwork variant={CARD_ARTWORK_VARIANTS[position % CARD_ARTWORK_VARIANTS.length]!} />
                      <span className={styles.cardBody}>
                        <span className={styles.cardTitle}>{entry.title}</span>
                        <span className={styles.cardSummary}>{entry.summary}</span>
                        {entry.originalTitle ? (
                          <span className={styles.originalTitle}>
                            <strong>{copy.originalLabel}</strong> <span lang="ko">{entry.originalTitle}</span>
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.readAction}>
                        {copy.readEntry} <span aria-hidden>↗</span>
                      </span>
                    </Link>
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
