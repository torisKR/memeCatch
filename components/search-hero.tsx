"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";

/**
 * 검색 히어로 (홈 최상단) — DESIGN.md §6 'SearchHero'.
 * - 대형 검색 인풋(placeholder, 불꽃 오렌지 포커스 링, 돋보기 아이콘), form action=/search.
 * - 헤드라인 "그 밈, 3초 안에 알려드려요" 단어별 스태거 진입(40ms).
 * - 인기 검색어 칩 가로 스크롤(popularTerms 있을 때만).
 * prefers-reduced-motion 존중: 애니메이션 끔.
 */

// 단어 단위 스태거 (띄어쓰기 보존을 위해 각 단어에 우측 공백 포함)
const HEADLINE_WORDS = ["그", "밈,", "3초", "안에", "알려드려요"];

export function SearchHero({ popularTerms = [] }: { popularTerms?: string[] }) {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: { staggerChildren: reduce ? 0 : 0.04 }, // 진입 스태거 40ms
    },
  };

  const wordVariant: Variants = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: "easeOut" },
        },
      };

  return (
    <section aria-label="밈 검색" className="pb-8 pt-10 md:pt-16">
      <motion.h1
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-wrap gap-x-[0.28em] gap-y-1 text-[2rem] font-extrabold leading-tight md:text-[2.5rem]"
      >
        {HEADLINE_WORDS.map((word, i) => (
          <motion.span key={i} variants={wordVariant} className="inline-block">
            {word}
          </motion.span>
        ))}
      </motion.h1>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: reduce ? 0 : 0.24, duration: 0.3, ease: "easeOut" }}
        className="mt-1.5 text-base text-muted"
      >
        뜻·유래부터 지금 써도 되는지까지 한 번에 확인해요.
      </motion.p>

      <form action="/search" role="search" className="mt-5">
        <label htmlFor="home-search" className="sr-only">
          밈 검색
        </label>
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
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
            className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base shadow-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:ring-4 focus:ring-accent/20"
          />
        </div>
      </form>

      {popularTerms.length > 0 && (
        <nav aria-label="인기 검색어" className="mt-3">
          <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1">
            {popularTerms.map((term) => (
              <li key={term} className="shrink-0 snap-start">
                <Link
                  href={`/search?q=${encodeURIComponent(term)}`}
                  className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
                >
                  {term}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
