import Link from "next/link";
import {
  ArrowRight,
  MessagesSquare,
  ShoppingBag,
} from "lucide-react";
import { HomeDiscovery } from "@/components/home/home-discovery";
import { HomeImmersiveStory } from "@/components/home/home-immersive-story";
import styles from "@/components/home/home-web3.module.css";
import { SafetySignalGuide } from "@/components/usage-guide";
import { HOME_COPY } from "@/lib/home-copy";
import { HOME_WEB3_COPY } from "@/lib/home-web3-copy";
import {
  localizedPath,
  type SeoRouteLocale,
} from "@/lib/i18n-routing";
import type { SafetyLevel } from "@/lib/labels";

export type HomeEntry = {
  id: string;
  href: string;
  title: string;
  summary: string;
  categoryLabel: string;
  originalTitle?: string;
  safetyLevel: SafetyLevel;
};

export function HomeExperience({
  locale,
  entries,
}: {
  locale: SeoRouteLocale;
  entries: readonly HomeEntry[];
}) {
  const copy = HOME_COPY[locale];
  const web3 = HOME_WEB3_COPY[locale];
  const searchPath = localizedPath("/search", locale);
  const explorePath = localizedPath("/explore?sort=recent", locale);
  const pathwaysTitleId = `home-pathways-title-${locale}`;
  const trustTitleId = `home-trust-title-${locale}`;

  return (
    <div className={styles.page}>
      <HomeImmersiveStory locale={locale} />

      <section
        id="home-latest"
        data-home-section="recent-content"
        aria-label={copy.recent.title}
        className={`${styles.editorialSection} ${styles.anchorTarget}`}
      >
        <span aria-hidden className={`${styles.sectionNumber} ${styles.discoveryNumber}`}>01</span>
        <HomeDiscovery locale={locale} entries={entries} />
        {entries.length > 0 ? (
          <div className={styles.recentSignalRail}>
            <Link href={explorePath} className={styles.contributionLinkStrong}>
              {copy.recent.all} <ArrowRight aria-hidden className={styles.buttonIcon} />
            </Link>
          </div>
        ) : (
          <div className={styles.emptyAssist}>
            <p>{copy.recent.empty}</p>
            <Link href={searchPath} className={styles.contributionLinkStrong}>
              {copy.recent.emptyAction}
            </Link>
          </div>
        )}
      </section>

      <section
        id="home-signals"
        data-home-section="usage-signals"
        className={`${styles.signalsSection} ${styles.anchorTarget}`}
      >
        <div className={styles.signalsFrame}>
          <span aria-hidden className={styles.sectionNumber}>02</span>
          <SafetySignalGuide locale={locale} />
        </div>
      </section>

      <section
        id="home-pathways"
        data-home-section="pathways"
        aria-labelledby={pathwaysTitleId}
        className={`${styles.pathwaysSection} ${styles.anchorTarget}`}
      >
        <div className={styles.sectionInner}>
          <header className={styles.pathwaysHeader}>
            <span aria-hidden className={styles.sectionNumber}>03</span>
            <h2 id={pathwaysTitleId} className={styles.sectionTitle}>
              {copy.pathways.title}
            </h2>
            <p className={styles.sectionDescription}>{copy.pathways.description}</p>
          </header>

          <div className={styles.pathwayGrid}>
            <Link
              href="/community"
              className={`${styles.pathwayCard} ${styles.communityCard}`}
            >
              <span aria-hidden className={styles.communityMotif} />
              <span className={styles.cardTop}>
                <MessagesSquare aria-hidden className={styles.cardIcon} />
                <span className={styles.cardMark}>{web3.pathways.communityMark}</span>
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>{copy.pathways.community.title}</span>
                <span className={styles.cardDescription}>
                  {copy.pathways.community.description}
                </span>
                <span className={styles.cardAction}>
                  {copy.pathways.community.action}
                  <ArrowRight aria-hidden className={styles.buttonIcon} />
                </span>
              </span>
            </Link>

            <Link
              href="/products"
              className={`${styles.pathwayCard} ${styles.productsCard}`}
            >
              <span aria-hidden className={styles.productsMotif} />
              <span className={styles.cardTop}>
                <ShoppingBag aria-hidden className={styles.cardIcon} />
                <span className={styles.cardMark}>{web3.pathways.productsMark}</span>
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardTitle}>{copy.pathways.products.title}</span>
                <span className={styles.cardDescription}>
                  {copy.pathways.products.description}
                </span>
                <span className={styles.cardAction}>
                  {copy.pathways.products.action}
                  <ArrowRight aria-hidden className={styles.buttonIcon} />
                </span>
              </span>
            </Link>
          </div>

          <div className={styles.contributionBar}>
            <p>{copy.pathways.contributionLabel}</p>
            <div className={styles.contributionLinks}>
              <Link href="/community/new" className={styles.contributionLink}>
                {copy.pathways.community.createAction}
              </Link>
              <Link href="/submit" rel="nofollow" className={styles.contributionLink}>
                {copy.pathways.submitAction}
              </Link>
              <Link href="/products/new" className={styles.contributionLinkStrong}>
                {copy.pathways.products.createAction}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <aside
        id="home-editorial"
        data-home-section="editorial-trust"
        aria-labelledby={trustTitleId}
        className={`${styles.editorialTrust} ${styles.anchorTarget}`}
      >
        <div className={styles.trustGrid}>
          <span aria-hidden className={styles.sectionNumber}>04</span>
          <div className={styles.trustCopy}>
            <h2 id={trustTitleId} className={styles.trustTitle}>
              {copy.trust.title}
            </h2>
            <p className={styles.trustDescription}>{copy.trust.description}</p>
            <nav aria-label={copy.trust.eyebrow}>
              <ul className={styles.trustLinks}>
                {copy.trust.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={styles.trustLink}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </aside>
    </div>
  );
}
