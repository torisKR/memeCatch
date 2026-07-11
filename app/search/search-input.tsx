"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/** 검색 인풋 — 디바운스 300ms + URL(?q=) 동기화. 초성 검색은 서버 RPC가 처리 */
export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const lastPushed = useRef(initialQuery);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === lastPushed.current) return;
    const timer = window.setTimeout(() => {
      lastPushed.current = trimmed;
      router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [value, router]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = value.trim();
        lastPushed.current = trimmed;
        router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
      }}
    >
      <label htmlFor="search-q" className="sr-only">
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
          id="search-q"
          name="q"
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="무슨 밈인지 검색해보세요"
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={!initialQuery}
          className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base shadow-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:ring-4 focus:ring-accent/20"
        />
      </div>
    </form>
  );
}
