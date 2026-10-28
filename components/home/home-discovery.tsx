import Link from "next/link";

import styles from "@/components/home/home-discovery.module.css";
import type { HomeEntry } from "@/components/home/home-experience";
import { MemeThumbnail } from "@/components/meme-thumbnail";
import { SafetyBadge } from "@/components/safety-badge";
import { HOME_DISCOVERY_COPY } from "@/lib/home-discovery-copy";
import type { SeoRouteLocale } from "@/lib/i18n-routing";

type HomeDiscoveryProps = {
  locale: SeoRouteLocale;
  entries: readonly HomeEntry[];
};

export function HomeDiscovery({ locale, entries }: HomeDiscoveryProps) {
  const copy = HOME_DISCOVERY_COPY[locale];
  const titleId = `home-discovery-title-${locale}`;

  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <header className={styles.heading}>
        <h2 id={titleId} className={styles.title}>{copy.title}</h2>
        <p className={styles.description}>{copy.description}</p>
      </header>

      {entries.length === 0 ? null : (
        <ul className={styles.grid} aria-label={copy.resultsLabel}>
          {entries.map((entry) => (
            <li className={styles.card} key={entry.id}>
              <Link className={styles.cardLink} href={entry.href}>
                {entry.thumbnailUrl ? <span className={styles.thumbnail}>
                  <MemeThumbnail
                    src={entry.thumbnailUrl ?? null}
                    title={entry.title}
                    category={entry.category ?? "phrase"}
                    variant="compact"
                  />
                </span> : null}
                <span className={styles.cardContent}>
                  <span className={styles.metaRow}>
                    <span className={styles.category}>{entry.categoryLabel}</span>
                    <SafetyBadge level={entry.safetyLevel} locale={locale} />
                  </span>
                  <span className={styles.cardTitle}>{entry.title}</span>
                  <span className={styles.cardSummary}>{entry.summary}</span>
                  {entry.originalTitle ? (
                    <span className={styles.originalTitle}>
                      {copy.originalLabel}: <span lang="ko">{entry.originalTitle}</span>
                    </span>
                  ) : null}
                  <span className={styles.readAction}>{copy.readEntry}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
