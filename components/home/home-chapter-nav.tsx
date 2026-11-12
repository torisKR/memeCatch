"use client";

import { useEffect, useRef, useState } from "react";
import { HOME_WEB3_COPY } from "@/lib/home-web3-copy";
import type { SeoRouteLocale } from "@/lib/i18n-routing";
import { H_RAIL_CLASS } from "@/lib/mobile-rail";
import styles from "./home-chapter-nav.module.css";

/** Native anchors remain usable without JavaScript; the client only tracks location. */
export function HomeChapterNav({ locale }: { locale: SeoRouteLocale }) {
  const copy = HOME_WEB3_COPY[locale];
  const [active, setActive] = useState<string>("#home-top");
  const rail = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame: number | null = null;
    const update = () => {
      frame = null;
      const nav = rail.current;
      const stickyTop = nav ? Number.parseFloat(getComputedStyle(nav).top) || 64 : 64;
      const boundary = stickyTop + (nav?.offsetHeight ?? 0) + 24;
      let current: string = copy.chapters[0].href;
      for (const chapter of copy.chapters) {
        const target = document.getElementById(chapter.href.slice(1));
        if (target && target.getBoundingClientRect().top <= boundary) current = chapter.href;
      }
      setActive(previous => previous === current ? previous : current);
    };
    const schedule = () => { if (frame === null) frame = requestAnimationFrame(update); };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("hashchange", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [copy.chapters]);

  return (
    <nav className={styles.rail} ref={rail} aria-label={copy.chapterLabel} data-home-chapters="true">
      <ol className={`${styles.list} ${H_RAIL_CLASS}`}>
        {copy.chapters.map((chapter, index) => (
          <li key={chapter.href}>
            <a className={styles.link} href={chapter.href} aria-current={active === chapter.href ? "location" : undefined}>
              <span className={styles.number} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              {chapter.label}
              <span className={styles.indicator} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
