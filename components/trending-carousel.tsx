"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "motion/react";
import { MemeCard } from "@/components/meme-card";
import type { MemeListItem } from "@/lib/queries";

/**
 * 홈 "오늘의 급상승" 가로 스트립 — 자동 이동 캐러셀.
 * - 4초마다 카드 1장 폭만큼 부드럽게 이동, 끝에 닿으면 처음으로 순환.
 * - 호버·터치·포커스·탭 비활성 시 일시정지 (사용자 조작 우선).
 * - prefers-reduced-motion이면 자동 이동 끔(수동 스크롤은 그대로).
 */
const ADVANCE_MS = 4000;

export function TrendingCarousel({ memes }: { memes: MemeListItem[] }) {
  const reduce = useReducedMotion();
  const scrollerRef = useRef<HTMLUListElement | null>(null);
  const pausedRef = useRef(false);

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
      const step = first.getBoundingClientRect().width + 12; // gap-3
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - step / 2;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: step, behavior: "smooth" });
      }
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
    <ul
      ref={scrollerRef}
      className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2"
      aria-label="오늘의 급상승 밈 목록 (자동 슬라이드, 마우스를 올리면 멈춤)"
    >
      {memes.map((meme) => (
        <li key={meme.id} className="w-52 shrink-0 snap-start">
          <MemeCard meme={meme} />
        </li>
      ))}
    </ul>
  );
}
