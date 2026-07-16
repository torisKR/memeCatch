"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { MemeCard } from "@/components/meme-card";
import type { MemeListItem } from "@/lib/queries";

/**
 * 홈 "오늘의 급상승" — 실시간 차트 캐러셀 (DESIGN §12 시세판 모티프 연장).
 * - 카드에 차트 순위 숫자(1~3위 불꽃 그라디언트) — 급상승은 실제 순위라 숫자가 정보다.
 * - 스냅 스크롤 + 좌우 컨트롤(데스크톱) + 불꽃색 진행 바 + 양끝 페이드.
 * - 4초 자동 이동(호버·터치·포커스·탭 비활성 시 정지), 끝에서 처음으로 순환.
 * - prefers-reduced-motion이면 자동 이동 끔(수동 스크롤·컨트롤은 유지).
 */
const ADVANCE_MS = 4000;
const GAP_PX = 12; // gap-3

export function TrendingCarousel({ memes }: { memes: MemeListItem[] }) {
  const reduce = useReducedMotion();
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const pausedRef = useRef(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const stepBy = useCallback((dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const first = el.querySelector("li");
    if (!first) return;
    const step = first.getBoundingClientRect().width + GAP_PX;
    el.scrollBy({ left: step * dir, behavior: "smooth" });
  }, []);

  // 진행 바 + 끝단 상태 — 스크롤마다 리렌더하지 않도록 바 폭은 ref로 직접 갱신
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const sync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = el.scrollWidth - el.clientWidth;
        const p = max > 0 ? el.scrollLeft / max : 0;
        if (progressRef.current) {
          progressRef.current.style.transform = `scaleX(${Math.max(0.04, p)})`;
        }
        setAtStart(el.scrollLeft <= 4);
        setAtEnd(max > 0 && el.scrollLeft >= max - 4);
      });
    };
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // 자동 이동 — 사용자 조작 우선
  useEffect(() => {
    if (reduce) return;
    const el = scrollerRef.current;
    if (!el) return;

    const pause = () => (pausedRef.current = true);
    const resume = () => (pausedRef.current = false);
    el.addEventListener("pointerenter", pause);
    el.addEventListener("pointerleave", resume);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resume);
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", resume);
    const onVis = () => (pausedRef.current = document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const timer = setInterval(() => {
      if (pausedRef.current) return;
      const first = el.querySelector("li");
      if (!first) return;
      const step = first.getBoundingClientRect().width + GAP_PX;
      const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - step / 2;
      if (end) el.scrollTo({ left: 0, behavior: "smooth" });
      else el.scrollBy({ left: step, behavior: "smooth" });
    }, ADVANCE_MS);

    return () => {
      clearInterval(timer);
      el.removeEventListener("pointerenter", pause);
      el.removeEventListener("pointerleave", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
      el.removeEventListener("focusin", pause);
      el.removeEventListener("focusout", resume);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduce]);

  return (
    <div className="group/carousel relative -mx-4 mt-3">
      <ul
        ref={scrollerRef}
        className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="오늘의 급상승 밈 차트 (자동 슬라이드, 마우스를 올리면 멈춤)"
      >
        {memes.map((meme, i) => (
          <li key={meme.id} className="w-52 shrink-0 snap-start">
            {/* 데스크톱 above-the-fold LCP: 처음 보이는 카드 썸네일을 즉시 로드 */}
            <MemeCard meme={meme} priority={i < 2} rank={i + 1} />
          </li>
        ))}
      </ul>

      {/* 양끝 페이드 — 이어짐 신호. 끝에 닿으면 해당 쪽 숨김 */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent transition-opacity duration-300 ${atStart ? "opacity-0" : "opacity-100"}`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity duration-300 ${atEnd ? "opacity-0" : "opacity-100"}`}
      />

      {/* 좌우 컨트롤 — 데스크톱, 캐러셀 호버·포커스 시 뚜렷해짐 */}
      <CarouselButton
        dir={-1}
        disabled={atStart}
        onClick={() => stepBy(-1)}
        label="이전 밈 보기"
      />
      <CarouselButton
        dir={1}
        disabled={atEnd}
        onClick={() => stepBy(1)}
        label="다음 밈 보기"
      />

      {/* 차트 진행 바 — 스크롤 위치를 불꽃 그라디언트로 시각화 */}
      <div className="mx-4 mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
        <div
          ref={progressRef}
          aria-hidden
          className="h-full w-full origin-left rounded-full"
          style={{
            transform: "scaleX(0.04)",
            background:
              "linear-gradient(90deg, var(--flame-400), var(--flame-600))",
            transition: "transform 150ms linear",
          }}
        />
      </div>
    </div>
  );
}

function CarouselButton({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: 1 | -1;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`absolute top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/95 text-foreground shadow-md backdrop-blur-sm transition-[opacity,transform] duration-200 hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 disabled:pointer-events-none disabled:opacity-0 md:flex ${
        dir === -1 ? "left-1" : "right-1"
      } opacity-0 focus-visible:opacity-100 group-hover/carousel:opacity-100 group-focus-within/carousel:opacity-100`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {dir === -1 ? <path d="m14.5 6-6 6 6 6" /> : <path d="m9.5 6 6 6-6 6" />}
      </svg>
    </button>
  );
}
