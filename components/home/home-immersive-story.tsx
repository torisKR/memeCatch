import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";

import { HomeScene } from "@/components/home/home-scene";
import { cjkKeepPhrases } from "@/lib/cjk-keep-phrase";
import { HOME_IMMERSIVE_COPY } from "@/lib/home-immersive-copy";
import { localizedPath, type SeoRouteLocale } from "@/lib/i18n-routing";
import { H_RAIL_CLASS } from "@/lib/mobile-rail";
import styles from "./home-immersive-story.module.css";

export function HomeImmersiveStory({ locale }: { locale: SeoRouteLocale }) {
  const copy = HOME_IMMERSIVE_COPY[locale];
  const searchId = `home-story-search-${locale}`;

  return (
    <section id="home-top" className={styles.story} data-home-scroll-track="true" data-home-section="hero-search" aria-label={copy.navigationLabel}>
      <nav className={`${styles.chapterNav} ${H_RAIL_CLASS}`} aria-label={copy.navigationLabel}>
        <ol className={styles.chapterNavList}>
          {copy.chapters.map((chapter, index) => (
            <li key={chapter.id}>
              <a className={styles.chapterNavLink} href={chapter.href}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{chapter.navigationLabel}
              </a>
            </li>
          ))}
        </ol>
        <a className={styles.skipLink} href="#home-latest">{copy.skipLabel}<ArrowRight aria-hidden="true" /></a>
      </nav>

      <div className={styles.composition} data-home-scroll-range="true">
        {copy.chapters.map((chapter, index) => {
          const Heading = index === 0 ? "h1" : "h2";
          const headingId = `home-story-${chapter.id}-title-${locale}`;
          return (
            <Fragment key={chapter.id}>
              <section id={`home-story-${chapter.id}`} className={styles.chapter} data-story-chapter={chapter.id} aria-labelledby={headingId}>
                <header className={styles.chapterHeading}>
                  <p className={styles.eyebrow}>{chapter.eyebrow}</p>
                  <Heading id={headingId} className={styles.chapterTitle}>
                    {cjkKeepPhrases(chapter.title, chapter.titlePhrases, styles.keepPhrase)}
                  </Heading>
                </header>
                <div className={styles.chapterCenter} aria-hidden="true" />
                <div className={styles.chapterPanel}>
                  <p className={styles.chapterDescription}>{chapter.description}</p>
                  {chapter.id === "discover" && (
                    <form action={localizedPath("/search", locale)} className={styles.searchForm} role="search" aria-label={copy.search.label}>
                      <label className={styles.searchLabel} htmlFor={searchId}>{copy.search.label}</label>
                      <div className={styles.searchShell}>
                        <Search className={styles.searchIcon} aria-hidden="true" />
                        <input id={searchId} className={styles.searchInput} name="q" type="search" autoComplete="off" enterKeyHint="search" placeholder={copy.search.placeholder} />
                        <button className={styles.searchButton} type="submit">{copy.search.button}<ArrowRight aria-hidden="true" /></button>
                      </div>
                    </form>
                  )}
                  {chapter.id === "context" && (
                    <a className={styles.textAction} href="#home-signals">{copy.contextAction}<ArrowRight aria-hidden="true" /></a>
                  )}
                  {chapter.id === "participate" && (
                    <div className={styles.actionRow}>
                      <Link className={styles.primaryAction} href="/community">{copy.communityAction}<ArrowRight aria-hidden="true" /></Link>
                    </div>
                  )}
                </div>
              </section>
              {index === 0 && (
                <div className={styles.visualPin} data-home-scroll-pin="true" data-home-artwork="immersive-story">
                  <HomeScene variant="story" className={styles.scene} locale={locale} label={copy.sceneLabel} pauseLabel={copy.pauseScene} playLabel={copy.playScene} />
                </div>
              )}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}
