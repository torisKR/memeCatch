import { ArrowRight, Search } from "lucide-react";

import { HOME_IMMERSIVE_COPY } from "@/lib/home-immersive-copy";
import { localizedPath, type SeoRouteLocale } from "@/lib/i18n-routing";
import styles from "./home-immersive-story.module.css";

export function HomeImmersiveStory({ locale }: { locale: SeoRouteLocale }) {
  const copy = HOME_IMMERSIVE_COPY[locale];
  const discover = copy.chapters[0];
  const searchId = `home-story-search-${locale}`;
  const headingId = `home-story-discover-title-${locale}`;

  return (
    <section
      id="home-top"
      className={styles.story}
      data-home-section="hero-search"
      aria-labelledby={headingId}
    >
      <a className={styles.skip} href="#home-latest">
        {copy.skipLabel}
        <ArrowRight aria-hidden="true" />
      </a>
      <div className={styles.hero}>
        <p className={styles.eyebrow}>{discover.eyebrow}</p>
        <h1 id={headingId} className={styles.title}>{discover.title}</h1>
        <p className={styles.description}>{discover.description}</p>
        <form
          action={localizedPath("/search", locale)}
          className={styles.searchForm}
          role="search"
          aria-label={copy.search.label}
        >
          <label className={styles.searchLabel} htmlFor={searchId}>{copy.search.label}</label>
          <div className={styles.searchShell}>
            <Search className={styles.searchIcon} aria-hidden="true" />
            <input
              id={searchId}
              className={styles.searchInput}
              name="q"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder={copy.search.placeholder}
            />
            <button className={styles.searchButton} type="submit">
              {copy.search.button}
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
