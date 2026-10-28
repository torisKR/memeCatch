import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HomeDiscovery } from "@/components/home/home-discovery";
import { HomeSearch } from "@/components/home/home-search";
import { HomeTrendDiscovery } from "@/components/home/home-trend-discovery";
import { TranslatedEditionHint } from "@/components/home/translated-edition-hint";
import styles from "@/components/home/home-web3.module.css";
import { HOME_COPY } from "@/lib/home-copy";
import { localizedPath, type SeoRouteLocale } from "@/lib/i18n-routing";
import type { MemeCategory, SafetyLevel } from "@/lib/labels";
import type { PublicMemeTrendSummary } from "@/lib/trend/public-evidence.server";

export type HomeEntry = {
  id: string;
  href: string;
  title: string;
  summary: string;
  categoryLabel: string;
  category?: MemeCategory;
  thumbnailUrl?: string | null;
  originalTitle?: string;
  safetyLevel: SafetyLevel;
};

export function HomeExperience({
  locale,
  entries,
  entryState = "ready",
  externalTrends = [],
}: {
  locale: SeoRouteLocale;
  entries: readonly HomeEntry[];
  entryState?: "ready" | "unavailable";
  externalTrends?: readonly PublicMemeTrendSummary[];
}) {
  const copy = HOME_COPY[locale];
  const searchPath = localizedPath("/search", locale);
  const explorePath = localizedPath("/explore", locale);

  return (
    <div className={styles.page}>
      {locale === "ko" && <TranslatedEditionHint />}
      <section
        id="home-top"
        data-home-section="hero-search"
        className={styles.hero}
        aria-labelledby={`home-title-${locale}`}
      >
        <div className={styles.heroCopy}>
          <h1 id={`home-title-${locale}`} className={styles.heroTitle}>
            {copy.hero.title}
          </h1>
          <p className={styles.heroIntro}>{copy.hero.intro}</p>
        </div>

        <HomeSearch
          locale={locale}
          action={searchPath}
          label={copy.hero.searchLabel}
          placeholder={copy.hero.searchPlaceholder}
          button={copy.hero.searchButton}
        />
      </section>

      <HomeTrendDiscovery locale={locale} entries={externalTrends} />

      <section
        id="home-latest"
        data-home-section="recent-content"
        aria-label={copy.recent.title}
        className={styles.recentSection}
      >
        {entryState === "ready" ? (
          <HomeDiscovery locale={locale} entries={entries} />
        ) : (
          <div
            className={styles.emptyState}
            data-home-recommendations="unavailable"
            role="status"
          >
            <p>{copy.recent.unavailable ?? copy.recent.empty}</p>
            <Link href={searchPath} className={styles.textLink}>
              {copy.recent.unavailableAction ?? copy.recent.emptyAction}
            </Link>
          </div>
        )}

        {entryState === "ready" && entries.length === 0 ? (
          <div className={styles.emptyState} data-home-recommendations="empty">
            <p>{copy.recent.empty}</p>
            <Link href={searchPath} className={styles.textLink}>
              {copy.recent.emptyAction}
            </Link>
          </div>
        ) : null}

        {entries.length > 0 ? (
          <div className={styles.recentActions}>
            <Link href={explorePath} className={styles.primaryLink}>
              {copy.recent.all} <ArrowRight aria-hidden />
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
