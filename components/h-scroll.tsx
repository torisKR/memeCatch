"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

/**
 * 가로 스크롤 스트립 공용 셸 (이어보기 / TOP 10 / 추후 스트립 공통).
 *
 * UX 근거:
 * - 스크롤바 숨김 + 양끝 페이드 마스크로 "더 있음" 어포던스 제공 (§5 horizontal-scroll 예외:
 *   의도된 캐러셀 패턴 — 세로 스크롤과 충돌하지 않는 보조 콘텐츠 줄)
 * - 데스크톱(sm+) 헤더 우측에 이전/다음 화살표 — hover 의존 없이 항상 노출, disabled 상태 명시
 * - snap-x + scroll-px-4: -mx-4 블리드에서도 스냅 위치가 콘텐츠 패딩과 정렬
 * - reduced-motion: smooth scroll 대신 즉시 이동
 * - 페이드는 mask-image라 배경색(라이트/다크) 무관
 */
export function HScrollSection({
  headingId,
  heading,
  className = "",
  children,
}: {
  headingId: string;
  heading: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const reduce = useReducedMotion();

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [update]);

  const page = (dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * el.clientWidth * 0.9,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  // 양끝 24px 페이드 — 스크롤 가능한 방향에만 적용 (끝 카드가 흐려 보이지 않게)
  const mask =
    canLeft && canRight
      ? "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)"
      : canLeft
        ? "linear-gradient(to right, transparent, black 24px)"
        : canRight
          ? "linear-gradient(to right, black calc(100% - 24px), transparent)"
          : undefined;

  const scrollable = canLeft || canRight;

  return (
    <section aria-labelledby={headingId} className={className}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="text-xl font-bold">
          {heading}
        </h2>
        {scrollable && (
          <div className="hidden shrink-0 gap-1.5 sm:flex">
            <ArrowButton dir={-1} disabled={!canLeft} onClick={() => page(-1)} label="이전 밈 보기" />
            <ArrowButton dir={1} disabled={!canRight} onClick={() => page(1)} label="다음 밈 보기" />
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className="-mx-4 mt-3 snap-x scroll-px-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      >
        {children}
      </div>
    </section>
  );
}

function ArrowButton({
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
      className="hover-glow-flame grid size-9 cursor-pointer place-items-center rounded-full border border-border bg-surface text-foreground shadow-sm transition-colors hover:bg-surface-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-35"
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {dir === -1 ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
      </svg>
    </button>
  );
}
