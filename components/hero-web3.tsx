"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import type { MemeListItem } from "@/lib/queries";
import { LIFECYCLE_STATUS, memePathFrom } from "@/lib/labels";

/**
 * 홈 히어로 v3 — web3 감성 인터랙티브 (DESIGN.md §12).
 * 다크 잉크 캔버스 + 불꽃 오로라(브랜드 오렌지, 보라 금지) + 미세 그리드/그레인 +
 * 커서 팔로우 글로우 + 밈 시세판 티커 + 카운트업 스탯 + 글래스 검색.
 * 모든 장식 모션은 transform/opacity만 사용, prefers-reduced-motion 시 전부 정지.
 */

const HEADLINE_WORDS = ["그", "밈,", "3초", "안에", "알려드려요"];

export function HeroWeb3({
  trending,
  totalCount,
  popularTerms = [],
}: {
  trending: MemeListItem[];
  totalCount: number;
  popularTerms?: string[];
}) {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement | null>(null);

  // 커서 팔로우 글로우 — CSS 변수만 갱신(리렌더 없음), 포인터 fine 환경에서만
  useEffect(() => {
    if (reduce) return;
    const el = sectionRef.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
        raf = 0;
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
  };
  const wordVariant: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 18, filter: "blur(6px)" },
        show: {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
        },
      };

  return (
    <section
      ref={sectionRef}
      aria-label="밈 검색"
      className="relative isolate overflow-hidden text-white"
      style={{ background: "var(--ink)", "--mx": "50%", "--my": "35%" } as React.CSSProperties}
    >
      {/* 오로라 — 불꽃 톤 대형 라디얼 2겹 (blur는 정적, 이동은 transform만) */}
      <div
        aria-hidden
        className="hero-aurora-a pointer-events-none absolute -left-1/4 -top-1/3 -z-10 h-[80%] w-[80%] rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--flame-600) 0%, transparent 70%)",
          animation: reduce ? undefined : "hero-aurora-a 16s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden
        className="hero-aurora-b pointer-events-none absolute -bottom-1/2 -right-1/4 -z-10 h-[90%] w-[90%] rounded-full opacity-30 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--flame-800) 0%, transparent 70%)",
          animation: reduce ? undefined : "hero-aurora-b 22s ease-in-out infinite",
        }}
      />
      {/* 미세 그리드 — 중앙만 보이도록 radial 마스크 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 30%, black 40%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 70% at 50% 30%, black 40%, transparent 100%)",
        }}
      />
      {/* 커서 팔로우 글로우 */}
      {!reduce && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
          style={{
            background:
              "radial-gradient(560px circle at var(--mx) var(--my), rgba(255,92,56,0.14), transparent 62%)",
          }}
        />
      )}
      {/* 그레인 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="mx-auto max-w-3xl px-4 pb-10 pt-14 md:pb-14 md:pt-20">
        {/* 라이브 배지 */}
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-[13px] font-semibold text-white/80 backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[--flame-400] opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[--flame-500]" />
          </span>
          실시간 한국 밈 사전 · <CountUp value={totalCount} reduce={!!reduce} />개 수록
        </motion.p>

        {/* 헤드라인 — 그라디언트 + 시머 */}
        <motion.h1
          variants={container}
          initial="hidden"
          animate="show"
          className="mt-5 flex flex-wrap gap-x-[0.26em] gap-y-1 text-[2.6rem] font-extrabold leading-[1.08] tracking-tight md:text-[3.6rem]"
        >
          {HEADLINE_WORDS.map((word, i) => (
            <motion.span
              key={i}
              variants={wordVariant}
              className={
                i >= 2
                  ? "hero-shimmer-text inline-block bg-clip-text text-transparent"
                  : "inline-block"
              }
              style={
                i >= 2
                  ? {
                      backgroundImage:
                        "linear-gradient(100deg, var(--flame-300) 0%, var(--flame-500) 35%, #ffd9cc 50%, var(--flame-500) 65%, var(--flame-300) 100%)",
                      backgroundSize: "200% 100%",
                      animation: reduce
                        ? undefined
                        : "hero-shimmer 5s linear infinite",
                    }
                  : undefined
              }
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.3, duration: 0.35 }}
          className="mt-3 max-w-xl text-base leading-relaxed text-white/65 md:text-lg"
        >
          뜻·유래부터 <span className="font-semibold text-white/90">지금 써도 되는지</span>까지 한
          번에. 신호등만 보면 됩니다.
        </motion.p>

        {/* 글래스 검색 */}
        <motion.form
          action="/search"
          role="search"
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.38, duration: 0.4 }}
          className="mt-7"
        >
          <label htmlFor="home-search" className="sr-only">
            밈 검색
          </label>
          <div className="group relative">
            {/* 포커스 시 외곽 글로우 */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
              style={{ boxShadow: "0 0 0 4px rgba(255,92,56,0.25), 0 8px 40px -8px rgba(255,92,56,0.35)" }}
            />
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-[--flame-400]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="home-search"
              name="q"
              type="search"
              placeholder="무슨 밈인지 검색해보세요"
              autoComplete="off"
              enterKeyHint="search"
              className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.07] pl-12 pr-4 text-base text-white placeholder-white/50 outline-none backdrop-blur-md transition-colors duration-200 focus:border-[--flame-400]"
            />
          </div>
        </motion.form>

        {/* 인기 검색어 칩 — 글래스 */}
        {popularTerms.length > 0 && (
          <motion.nav
            aria-label="인기 검색어"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduce ? 0 : 0.5, duration: 0.4 }}
            className="mt-4"
          >
            <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
              {popularTerms.map((term) => (
                <li key={term} className="shrink-0 snap-start">
                  <Link
                    href={`/search?q=${encodeURIComponent(term)}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.06] px-4 text-sm font-medium text-white/75 backdrop-blur-sm transition-[color,background-color,border-color,transform] duration-200 hover:border-[--flame-400]/60 hover:bg-[--flame-500]/15 hover:text-white active:scale-[0.96]"
                  >
                    {term}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </div>

      {/* 밈 시세판 티커 — 코인 티커 감성, 호버 시 정지 */}
      {trending.length > 0 && (
        <div
          className="hero-marquee relative border-t border-white/10 bg-black/25 py-3 backdrop-blur-sm"
          aria-label="지금 뜨는 밈 티커"
        >
          <div className="hero-marquee-track flex w-max gap-8 px-4">
            {[...trending, ...trending].map((m, i) => (
              <Link
                key={`${m.id}-${i}`}
                href={memePathFrom(m.short_id, m.slug)}
                aria-hidden={i >= trending.length || undefined}
                tabIndex={i >= trending.length ? -1 : undefined}
                className="-my-2 flex shrink-0 items-center gap-2 py-2 text-sm text-white/70 transition-colors hover:text-white"
              >
                {/* 상승 아이콘 — 텍스트 글리프 대신 SVG(스트로크 통일) */}
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-3.5 shrink-0 text-[--flame-400]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 17 10 11l4 4 6-7" />
                  <path d="M15 8h5v5" />
                </svg>
                <span className="font-semibold">{m.title}</span>
                <span className="text-xs text-white/55">
                  {LIFECYCLE_STATUS[m.lifecycle_status]?.user ?? ""}
                </span>
              </Link>
            ))}
          </div>
          {/* 좌우 페이드 */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[--ink] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[--ink] to-transparent" />
        </div>
      )}
    </section>
  );
}

/**
 * 카운트업 — SSR/초기 HTML에는 **실제 최종값**을 렌더(AI 크롤러·JS 미실행 환경이
 * "0개 수록"으로 보는 문제 방지). 마운트 후에만 0→값 애니메이션.
 * reduced-motion이면 애니메이션 없이 최종값 유지.
 */
function CountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (reduce) return; // SSR 값(최종값) 그대로 유지
    let raf = 0;
    const t0 = performance.now();
    const dur = 1200;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return <span className="tabular-nums font-bold text-white">{n.toLocaleString()}</span>;
}
