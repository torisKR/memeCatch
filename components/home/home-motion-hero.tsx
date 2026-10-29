"use client";

import Link from "next/link";
import { ArrowRight, Pause, Play, Search } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import styles from "@/components/home/home-motion-hero.module.css";
import type { HomeEntry } from "@/components/home/home-experience";
import { SafetyIcon } from "@/components/safety-icon";
import { HOME_COPY } from "@/lib/home-copy";
import type { SeoRouteLocale } from "@/lib/i18n-routing";
import { SAFETY_SIGNAL_LEVELS, getSafetySignalCopy } from "@/lib/safety-copy";

const MAX_ITEMS = 5;
const TYPE_SECONDS_PER_CHAR = 0.07;
const MAX_TYPE_SECONDS = 1.1;

/**
 * 홈 히어로 모션 장면. 실제 편집 추천 항목으로 "검색 → 뜻 → 사용 신호" 순서를 반복 재생한다.
 * 타이밍은 CSS 애니메이션이 전부 맡고, 진행 막대의 animationend가 다음 항목으로 넘긴다.
 * 그래서 일시정지(animation-play-state)와 reduced-motion(animation: none, 자동 전환 없음)이
 * 별도 타이머 없이 같은 규칙으로 동작한다. JS 없이도 첫 항목이 완성된 상태로 보인다.
 */
export function HomeMotionHero({
  locale,
  entries,
}: {
  locale: SeoRouteLocale;
  entries: readonly HomeEntry[];
}) {
  const items = entries.slice(0, MAX_ITEMS);
  const copy = HOME_COPY[locale];
  const signalCopy = getSafetySignalCopy(locale);
  const [cycle, setCycle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    let visible = true;
    let hidden = document.visibilityState === "hidden";
    const sync = () => setOffscreen(!visible || hidden);
    const observer = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(([entry]) => {
        visible = entry?.isIntersecting ?? true;
        sync();
      });
    observer?.observe(node);
    const onVisibility = () => {
      hidden = document.visibilityState === "hidden";
      sync();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (items.length === 0) return null;

  const position = cycle % items.length;
  const active = items[position];
  const typeSteps = Math.max(1, Array.from(active.title).length);
  const typeSeconds = Math.min(MAX_TYPE_SECONDS, typeSteps * TYPE_SECONDS_PER_CHAR);
  const signal = signalCopy.levels[active.safetyLevel];
  const stageStyle = {
    "--type-steps": typeSteps,
    "--type-dur": `${typeSeconds.toFixed(2)}s`,
    "--active-signal": `var(--safety-${active.safetyLevel})`,
  } as CSSProperties;

  const select = (target: number) => {
    const step = (target - position + items.length) % items.length;
    setCycle((value) => value + (step === 0 ? items.length : step));
  };

  return (
    <div
      ref={rootRef}
      role="region"
      aria-label={copy.motion.label}
      className={styles.root}
      data-home-motion
      data-paused={paused || offscreen ? "true" : undefined}
      style={stageStyle}
    >
      <span aria-hidden className={styles.halo} />

      <div className={styles.toolbar}>
        <span className={styles.status}>
          <span aria-hidden className={styles.statusDot} />
          {copy.motion.label}
        </span>
        <button
          type="button"
          className={styles.pauseButton}
          aria-label={paused ? copy.motion.play : copy.motion.pause}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
        </button>
      </div>

      <div key={cycle} className={styles.stage} data-motion-entry={active.id}>
        <div aria-hidden className={styles.query}>
          <Search />
          <span className={styles.queryText}>{active.title}</span>
          <span className={styles.caret} />
        </div>

        <Link href={active.href} className={styles.card}>
          <span className={styles.category}>{active.categoryLabel}</span>
          <span className={styles.title}>{active.title}</span>
          <span className={styles.summary}>{active.summary}</span>
          <span className={styles.signalRow}>
            <span aria-hidden className={styles.signals}>
              {SAFETY_SIGNAL_LEVELS.map((level) => (
                <span
                  key={level}
                  className={styles.signal}
                  data-active={level === active.safetyLevel ? "true" : undefined}
                  style={{
                    "--signal": `var(--safety-${level})`,
                    "--signal-bg": `var(--safety-${level}-bg)`,
                  } as CSSProperties}
                >
                  <SafetyIcon level={level} className={styles.signalIcon} />
                </span>
              ))}
            </span>
            <span className={styles.signalLabel} data-motion-signal={active.safetyLevel}>
              <span className={styles.signalTitle}>{signalCopy.badgeTitle}</span>
              {signal.label}
            </span>
          </span>
          <span className={styles.read}>
            {copy.recent.read} <ArrowRight aria-hidden />
          </span>
        </Link>
      </div>

      <div className={styles.footer}>
        <span aria-hidden className={styles.progress}>
          <span
            key={cycle}
            className={styles.progressFill}
            data-motion-progress
            onAnimationEnd={() => setCycle((value) => value + 1)}
          />
        </span>
        {items.length > 1 ? (
          <span className={styles.dots}>
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={styles.dot}
                aria-label={`${copy.motion.show}: ${item.title}`}
                aria-pressed={index === position}
                onClick={() => select(index)}
              />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  );
}
