"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import type { MemeListItem } from "@/lib/queries";
import { LIFECYCLE_STATUS, SAFETY_LEVELS, memePathFrom } from "@/lib/labels";

/**
 * 홈 히어로 v4 — 랜딩형 스플릿 (2026-07 전면 리뉴얼, DESIGN.md §12 계승).
 * 좌: LIVE 신호 라벨 + "그 밈, 3초 안에 캐치." + 글래스 검색 + 급상승 칩 +
 *     탐색/제보 CTA + 실데이터 수록 지표.
 * 우(lg+): Higgsfield 생성 브랜드 아트 + 실데이터 플로팅 신호 카드 2장.
 * 모바일: 아트를 저불투명 배경 레이어로 깔아 폴드를 지킨다.
 * 장식 모션은 transform/opacity만, prefers-reduced-motion 시 전부 정지.
 */

const HEADLINE_WORDS = ["그", "밈,", "3초", "안에", "캐치."];

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

  // 커서 팔로우 글로우 — CSS 변수만 갱신(리렌더 없음), 포인터 fine 환경에서만.
  // rect는 스크롤/리사이즈 때만 재측정(강제 동기 리플로우 방지), 리스너는 passive.
  useEffect(() => {
    if (reduce) return;
    const el = sectionRef.current;
    if (!el || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    let rect = el.getBoundingClientRect();
    const measure = () => {
      rect = el.getBoundingClientRect();
    };
    const onMove = (e: PointerEvent) => {
      if (raf) return;
      const { clientX, clientY } = e;
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${clientX - rect.left}px`);
        el.style.setProperty("--my", `${clientY - rect.top}px`);
        raf = 0;
      });
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce]);

  return (
    <section
      ref={sectionRef}
      aria-label="밈 검색"
      className="relative isolate overflow-hidden text-white"
      style={{ background: "var(--ink)", "--mx": "50%", "--my": "35%" } as React.CSSProperties}
    >
      {/* 모바일 전용 배경 아트 — lg+에선 우측 칼럼 <img>가 대신한다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-20 bg-cover bg-[position:85%_25%] opacity-35 lg:hidden"
        style={{
          backgroundImage: "url(/brand/hero-meme-signal-mobile.webp)",
          maskImage: "linear-gradient(to bottom, black 40%, transparent 97%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 40%, transparent 97%)",
        }}
      />
      {/* 오로라 — 불꽃 톤 라디얼(blur 정적, 이동은 transform만) */}
      <div
        aria-hidden
        className="hero-aurora-a pointer-events-none absolute -left-1/4 -top-1/3 -z-10 h-[80%] w-[80%] rounded-full opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, var(--flame-600) 0%, transparent 70%)",
          animation: reduce ? undefined : "hero-aurora-a 16s ease-in-out infinite",
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

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-7 pt-10 md:pb-14 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,44%)]">
        {/* ── 좌: 카피 + 검색 + CTA ─────────────────────────── */}
        <div className="max-w-2xl">
          {/* LIVE 신호 라벨 — 영문 소형 라벨은 mono(§3 타이포 규칙) */}
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3.5 py-1.5 font-mono text-xs font-semibold tracking-[0.14em] text-white/85 backdrop-blur-sm">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-(--signal-cyan) opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-(--signal-cyan)" />
            </span>
            LIVE K-MEME SIGNAL
          </p>

          {/* 헤드라인 — LCP 요소: CSS 진입(.hero-headline-in)으로 첫 페인트 즉시 렌더 */}
          <h1 className="hero-headline-in mt-5 flex flex-wrap gap-x-[0.26em] gap-y-1 text-[2.6rem] font-extrabold leading-[1.08] tracking-tight md:text-[3.4rem]">
            {HEADLINE_WORDS.map((word, i) => (
              <span
                key={i}
                className={
                  i >= 2 ? "inline-block text-(--flame-400)" : "inline-block"
                }
              >
                {word}
              </span>
            ))}
          </h1>

          <p className="mt-3 max-w-xl text-base leading-relaxed text-white/65 md:text-lg">
            뜻·유래·사용 타이밍까지.{" "}
            <span className="font-semibold text-white/90">지금 써도 되는지</span> 신호
            하나로 확인하세요.
          </p>

          {/* 글래스 검색 — 홈에서 가장 중요한 UI */}
          <form action="/search" role="search" className="mt-7">
            <label htmlFor="home-search" className="sr-only">
              밈 검색
            </label>
            <div className="group relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-300 group-focus-within:opacity-100"
                style={{ boxShadow: "0 0 0 4px rgba(255,92,56,0.25), 0 8px 40px -8px rgba(255,92,56,0.35)" }}
              />
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-(--flame-400)"
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
                placeholder="궁금한 밈·유행어를 검색해보세요"
                autoComplete="off"
                enterKeyHint="search"
                className="h-14 w-full rounded-2xl border border-white/15 bg-white/[0.07] pl-12 pr-4 text-base text-white placeholder-white/50 outline-none backdrop-blur-md transition-colors duration-200 focus:border-(--flame-400)"
              />
            </div>
          </form>

          {/* 인기 검색어 칩 — 급상승 제목 재사용(실데이터) */}
          {popularTerms.length > 0 && (
            <nav aria-label="인기 검색어" className="mt-4">
              <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
                {popularTerms.slice(0, 6).map((term) => (
                  <li key={term} className="shrink-0 snap-start">
                    <Link
                      href={`/search?q=${encodeURIComponent(term)}`}
                      className="inline-flex min-h-10 items-center rounded-full border border-white/20 bg-white/[0.07] px-3.5 text-sm font-medium text-white/85 backdrop-blur-sm transition-[color,background-color,border-color,transform] duration-200 hover:border-(--flame-400)/60 hover:bg-(--flame-500)/15 hover:text-white active:scale-[0.96]"
                    >
                      {term}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}

          {/* 주 CTA(탐색) + 보조 CTA(제보) */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/explore"
              className="inline-flex min-h-12 items-center gap-1.5 rounded-2xl bg-accent-strong px-6 text-base font-bold text-white shadow-[0_8px_30px_-8px_rgba(255,92,56,0.6)] transition-transform active:scale-[0.97]"
            >
              밈 탐색하기 <span aria-hidden>→</span>
            </Link>
            <Link
              href="/submit"
              className="inline-flex min-h-12 items-center rounded-2xl border border-white/20 bg-white/[0.06] px-5 text-base font-semibold text-white/85 backdrop-blur-sm transition-colors hover:border-(--flame-400)/60 hover:text-white active:scale-[0.97]"
            >
              새 밈 제보
            </Link>
          </div>

          {/* 실데이터 지표 — getTotalMemeCount() 단일 소스(하드코딩 금지) */}
          {totalCount > 0 && (
            <p className="mt-5 text-sm text-white/60">
              1990년대부터 지금까지 <CountUp value={totalCount} reduce={!!reduce} />개의 밈을
              기록 중이에요 · 로그인 없이 바로 볼 수 있어요
            </p>
          )}
        </div>

        {/* ── 우(lg+): 브랜드 아트 + 플로팅 신호 카드 ───────────── */}
        <div className="relative hidden lg:block" aria-hidden>
          <picture>
            <source srcSet="/brand/hero-meme-signal.avif" type="image/avif" />
            <img
              src="/brand/hero-meme-signal.webp"
              alt=""
              width={1600}
              height={893}
              fetchPriority="high"
              decoding="async"
              className="w-full rounded-3xl border border-white/10 object-cover shadow-[0_24px_80px_-24px_rgba(0,0,0,0.8)]"
            />
          </picture>
          {/* 아트 하단 잉크 페이드 — 플로팅 카드 대비 확보 */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              background:
                "linear-gradient(to top, rgba(15,15,18,0.55) 0%, transparent 45%)",
            }}
          />
          {trending[0] && (
            <FloatingSignalCard meme={trending[0]} className="-left-6 top-8" />
          )}
          {trending[1] && (
            <FloatingSignalCard meme={trending[1]} className="-bottom-4 right-6" />
          )}
        </div>
      </div>

      {/* 밈 시세판 티커 — 실시간 Signal strip(호버·포커스 시 정지) */}
      {trending.length > 0 && (
        <div
          className="hero-marquee relative border-t border-white/10 bg-black/25 py-2 backdrop-blur-sm md:py-3"
          aria-label="지금 뜨는 밈 티커"
        >
          <div className="hero-marquee-track flex w-max gap-8 px-4">
            {[...trending, ...trending].map((m, i) => (
              <Link
                key={`${m.id}-${i}`}
                href={memePathFrom(m.short_id, m.slug)}
                aria-hidden={i >= trending.length || undefined}
                tabIndex={i >= trending.length ? -1 : undefined}
                className="-my-3 flex shrink-0 items-center gap-2 py-3 text-sm text-white/70 transition-colors hover:text-white"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden
                  className="size-3.5 shrink-0 text-(--flame-400)"
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
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-(--ink) to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-(--ink) to-transparent" />
        </div>
      )}
    </section>
  );
}

/**
 * 플로팅 신호 카드 — 급상승 실데이터(제목·생명주기·안전 신호)만 표시.
 * 부모가 aria-hidden(장식 칼럼)이라 정보는 티커·본문에서 중복 제공된다.
 */
function FloatingSignalCard({
  meme,
  className,
}: {
  meme: MemeListItem;
  className?: string;
}) {
  const safety = SAFETY_LEVELS[meme.safety_level];
  const life = LIFECYCLE_STATUS[meme.lifecycle_status];
  return (
    <div
      className={`absolute flex max-w-56 flex-col gap-1 rounded-2xl border border-white/15 bg-black/55 px-4 py-3 shadow-xl backdrop-blur-md ${className ?? ""}`}
    >
      <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-(--signal-cyan)">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {life?.user ?? ""}
      </span>
      <span className="truncate text-sm font-bold text-white">{meme.title}</span>
      {safety && (
        <span className="text-xs text-white/70">
          {/* 토큰명이 동적이라 Tailwind 정적 클래스 대신 인라인 var 사용 */}
          <span aria-hidden className="mr-1" style={{ color: `var(--${safety.token})` }}>
            {safety.icon}
          </span>
          {safety.user}
        </span>
      )}
    </div>
  );
}

/**
 * 카운트업 — SSR/초기 HTML에는 실제 최종값을 렌더(JS 미실행 환경 "0개" 방지).
 * 마운트 후에만 0→값 애니메이션, reduced-motion이면 최종값 유지.
 */
function CountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const [n, setN] = useState(value);
  useEffect(() => {
    if (reduce) return;
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
