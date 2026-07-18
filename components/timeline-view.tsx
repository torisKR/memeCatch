"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { MemeCard } from "@/components/meme-card";
import { Reveal } from "@/components/reveal";
import type { MemeListItem } from "@/lib/queries";

/**
 * /timeline 전용 뷰 (레인 A).
 * 연대(decade) → 연도(year) → 대표 밈(4~8개) 구조를 렌더링한다.
 * 데스크톱: 연도 마커를 좌측에 고정하고 우측 카드가 컨테이너 안에서 반응형 그리드로 흐른다.
 * 모바일: 상단 스티키 연대 탭 + 세로 스택(연도 라벨 위, 카드 2열 그리드 아래) — 가로 오버플로 0.
 * 카드 클릭 시 GA4 timeline_click 이벤트를 기록한다(내비게이션은 MemeCard의 Link가 그대로 처리).
 *
 * 무한스크롤: 전체 연표(~36년 × 최대 8장 ≈ 290카드)를 한 번에 마운트하면 초기
 * DOM·하이드레이션이 무거워, 연도 행 단위로 잘라 하단 센티널(IntersectionObserver)에
 * 닿을 때마다 다음 배치를 마운트한다. 데이터는 이미 서버(ISR)가 넘긴 props를 그대로
 * 쓰므로 스크롤 시 추가 네트워크·DB 조회는 없다(방문자당 API 호출을 만들지 않는 선택).
 * 연대 탭·해시 딥링크는 해당 연대까지 강제 마운트한 뒤 스크롤한다.
 */

export type TimelineYear = {
  year: number;
  memes: MemeListItem[];
};

export type TimelineDecade = {
  /** 앵커·이벤트용 키 (예: "1990s") */
  key: string;
  /** 노출 라벨 (예: "1990년대") */
  label: string;
  years: TimelineYear[];
};

/** 첫 화면에 마운트할 연도 행 수 (행당 카드 최대 8장) */
const INITIAL_ROWS = 4;
/** 센티널 교차마다 추가 마운트할 연도 행 수 */
const ROWS_PER_BATCH = 4;

export function TimelineView({ decades }: { decades: TimelineDecade[] }) {
  const totalRows = decades.reduce((n, d) => n + d.years.length, 0);
  const [visibleRows, setVisibleRows] = useState(() =>
    Math.min(INITIAL_ROWS, totalRows)
  );
  const sentinelRef = useRef<HTMLDivElement>(null);
  const allShown = visibleRows >= totalRows;

  // 연대별 시작 행 인덱스 — 탭·해시로 특정 연대를 열 때 필요한 마운트 수 계산용
  const decadeStartIndex = useMemo(() => {
    const map = new Map<string, number>();
    let index = 0;
    for (const d of decades) {
      map.set(d.key, index);
      index += d.years.length;
    }
    return map;
  }, [decades]);

  // 배치마다 옵저버를 재생성한다(visibleRows 의존): IO는 교차 '변화'에만 콜백하므로
  // 배치 후에도 센티널이 마진 안에 남으면 옵저버를 다시 만들어야 즉시(생성 시점
  // 초기 콜백) 다음 배치가 이어진다 — 1회 생성 방식은 이 경우 영구 정지한다.
  useEffect(() => {
    if (allShown) return;
    const el = sentinelRef.current;
    // IO 미지원(구형 브라우저)이면 전체 마운트 폴백 — 콘텐츠가 숨겨지는 일은 없게
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisibleRows(totalRows);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleRows((n) => Math.min(n + ROWS_PER_BATCH, totalRows));
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [allShown, totalRows, visibleRows]);

  function revealDecade(key: string, scroll: boolean) {
    const start = decadeStartIndex.get(key);
    if (start == null) return;
    // 해당 연대의 첫 연도 행까지 마운트(이후 행은 센티널이 이어받음)
    setVisibleRows((n) => Math.max(n, start + 1));
    if (!scroll) return;
    // 마운트 커밋 후 스크롤 — 두 프레임 대기로 레이아웃 확정을 기다린다
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.getElementById(`decade-${key}`);
        if (!target) return;
        const reduce = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        target.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
      });
    });
  }

  // 해시 딥링크(#decade-2020s)로 진입한 경우 그 연대까지 즉시 마운트
  useEffect(() => {
    const match = window.location.hash.match(/^#decade-(.+)$/);
    if (!match || !decadeStartIndex.has(match[1])) return;
    const frame = requestAnimationFrame(() => revealDecade(match[1], true));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* 모바일 전용 스티키 연대 탭 — 헤더(h-14) 바로 아래에 고정 */}
      {decades.length > 1 && (
        <nav
          aria-label="연대 바로가기"
          className="sticky top-14 z-[5] -mx-4 flex gap-2 overflow-x-auto border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:hidden"
        >
          {decades.map((d) => (
            <a
              key={d.key}
              href={`#decade-${d.key}`}
              onClick={(e) => {
                e.preventDefault();
                history.replaceState(null, "", `#decade-${d.key}`);
                revealDecade(d.key, true);
              }}
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {d.label}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-8 space-y-12">
        {decades.map((decade) => {
          const start = decadeStartIndex.get(decade.key) ?? 0;
          const visibleInDecade = Math.min(
            Math.max(visibleRows - start, 0),
            decade.years.length
          );
          if (visibleInDecade <= 0) return null;
          return (
            <Reveal
              key={decade.key}
              as="section"
              aria-labelledby={`decade-${decade.key}`}
            >
              <h2
                id={`decade-${decade.key}`}
                className="scroll-mt-24 text-2xl font-extrabold tracking-tight"
              >
                {decade.label}
              </h2>

              {/* 행별 독립 Reveal — 컨테이너 스태거(MotionList)는 once 발동 후
                  나중에 마운트된 자식이 hidden(opacity 0)에 갇혀 무한스크롤로
                  추가된 행이 안 보이는 버그가 있어, 행마다 자기 whileInView를 갖게 한다 */}
              <div className="mt-5 space-y-7">
                {decade.years.slice(0, visibleInDecade).map((yearGroup) => (
                  <Reveal key={yearGroup.year}>
                    <YearRow decadeKey={decade.key} yearGroup={yearGroup} />
                  </Reveal>
                ))}
              </div>
            </Reveal>
          );
        })}
      </div>

      {!allShown && (
        <div ref={sentinelRef} aria-hidden className="h-px" />
      )}
    </div>
  );
}

function YearRow({
  decadeKey,
  yearGroup,
}: {
  decadeKey: string;
  yearGroup: TimelineYear;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-5 lg:gap-6">
      {/* 연도 마커 — 데스크톱에서 좌측 축에 고정, 모바일에서 카드 위 라벨 */}
      <div className="flex shrink-0 items-center gap-2 sm:w-20 sm:flex-col sm:items-start sm:gap-0 sm:pt-1.5 lg:w-24">
        <span className="whitespace-nowrap text-xl font-extrabold tabular-nums tracking-tight text-accent sm:text-2xl">
          {yearGroup.year}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border sm:hidden" />
      </div>

      {/* 모든 뷰포트에서 컨테이너 안에 머무는 반응형 그리드 — 우측 잘림·페이지 가로 스크롤 방지 */}
      <div className="grid min-w-0 flex-1 grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {yearGroup.memes.map((meme) => (
          <div
            key={meme.id}
            className="min-w-0"
            onClick={() =>
              track("timeline_click", {
                meme_id: meme.id,
                year: yearGroup.year,
                decade: decadeKey,
              })
            }
          >
            <MemeCard meme={meme} />
          </div>
        ))}
      </div>
    </div>
  );
}
