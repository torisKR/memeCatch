import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HomeImmersiveStory } from "@/components/home/home-immersive-story";
import styles from "@/components/home/home-web3.module.css";
import { MemePosterCard } from "@/components/meme-poster-card";
import { SafetySignalGuide } from "@/components/usage-guide";
import { HomeSafetyShowcase } from "@/components/home/home-safety-showcase";
import { SafetyDiagnosticQuiz } from "@/components/safety-diagnostic-quiz";
import { CURATED_CORE_MEMES, curatedPassesIndexGate } from "@/lib/curated-memes";
import { HOME_COPY } from "@/lib/home-copy";
import {
  localizedPath,
  type SeoRouteLocale,
} from "@/lib/i18n-routing";
import type { MemeCategory, SafetyLevel } from "@/lib/labels";

export type HomeEntry = {
  id: string;
  href: string;
  title: string;
  summary: string;
  categoryLabel: string;
  category?: MemeCategory;
  thumbnailUrl?: string | null;
  artUrl?: string | null;
  year?: number | null;
  originalTitle?: string;
  safetyLevel: SafetyLevel;
};

/** Four 4:3 posters stay above the fold at 1280×800. The rest are on /explore. */
const TRENDING_LIMIT = 4;

export function HomeExperience({
  locale,
  entries,
}: {
  locale: SeoRouteLocale;
  entries: readonly HomeEntry[];
}) {
  const copy = HOME_COPY[locale];
  const searchPath = localizedPath("/search", locale);
  const explorePath = localizedPath("/explore", locale);
  const pathwaysTitleId = `home-pathways-title-${locale}`;
  const trustTitleId = `home-trust-title-${locale}`;
  const trendingTitleId = `home-trending-title-${locale}`;
  const trending = entries.slice(0, TRENDING_LIMIT);
  const showSafetyGuide = CURATED_CORE_MEMES.some((meme) => curatedPassesIndexGate(meme));
  const trendingTitle = locale === "ko" ? "지금 뜨는 밈" : copy.recent.title;

  return (
    <div className={styles.page}>
      <HomeImmersiveStory locale={locale} />

      <section
        id="home-latest"
        data-home-section="trending-memes"
        aria-labelledby={trendingTitleId}
        className={styles.trendingSection}
      >
        <div className={styles.trendingHeader}>
          <h2 id={trendingTitleId} className={styles.trendingHeading}>
            {trendingTitle}
          </h2>
        </div>
        {trending.length > 0 ? (
          <>
            <ul className={styles.trendingGrid}>
              {trending.map((entry, index) => (
                <li key={entry.id}>
                  <Link href={entry.href} className={styles.trendingCard}>
                    <MemePosterCard
                      title={entry.title}
                      summary={entry.summary}
                      safetyLevel={entry.safetyLevel}
                      year={entry.year}
                      artUrl={entry.artUrl}
                      size="grid"
                      locale={locale}
                      priority={index < 4}
                    />
                    {entry.originalTitle ? (
                      <span className="sr-only" lang="ko">{entry.originalTitle}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={explorePath} className={styles.exploreButton} data-cta="explore">
              {copy.recent.all}
              <ArrowRight aria-hidden className={styles.buttonIcon} />
            </Link>
          </>
        ) : (
          <div className={styles.emptyAssist}>
            <p>{copy.recent.empty}</p>
            <Link href={searchPath} className={styles.exploreButton}>
              {copy.recent.emptyAction}
            </Link>
          </div>
        )}
      </section>

      {showSafetyGuide ? (
        <section
          id="home-safety-showcase"
          data-home-section="safety-showcase"
          className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
        >
          <HomeSafetyShowcase />
        </section>
      ) : null}

      <section
        id="home-safety-quiz"
        data-home-section="safety-quiz"
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6"
      >
        <SafetyDiagnosticQuiz />
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

          <div className={styles.ctaRow}>
            {locale === "ko" ? (
              <>
                <Link href="/originals" className={styles.primaryCta} data-cta="primary">
                  오리지널 보러 가기
                </Link>
                <Link href="/submit" rel="nofollow" className={styles.primaryCta} data-cta="primary">
                  밈 올리기
                </Link>
              </>
            ) : (
              <Link href="/submit" rel="nofollow" className={styles.primaryCta} data-cta="primary">
                {copy.pathways.submitAction}
              </Link>
            )}
            <Link href="/community" className={styles.secondaryCta} data-cta="secondary">
              {copy.pathways.community.action}
            </Link>
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
