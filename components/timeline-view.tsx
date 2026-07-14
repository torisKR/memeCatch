"use client";

import { track } from "@/lib/analytics";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { Reveal } from "@/components/reveal";
import type { MemeListItem } from "@/lib/queries";

/**
 * /timeline 전용 뷰 (레인 A).
 * 연대(decade) → 연도(year) → 대표 밈(4~8개) 구조를 렌더링한다.
 * 데스크톱: 연도 마커를 좌측에 고정하고 우측 카드가 컨테이너 안에서 반응형 그리드로 흐른다.
 * 모바일: 상단 스티키 연대 탭 + 세로 스택(연도 라벨 위, 카드 2열 그리드 아래) — 가로 오버플로 0.
 * 카드 클릭 시 GA4 timeline_click 이벤트를 기록한다(내비게이션은 MemeCard의 Link가 그대로 처리).
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

export function TimelineView({ decades }: { decades: TimelineDecade[] }) {
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
              className="inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-border px-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent"
            >
              {d.label}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-8 space-y-12">
        {decades.map((decade) => (
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

            <MotionList as="div" itemAs="div" className="mt-5 space-y-7">
              {decade.years.map((yearGroup) => (
                <YearRow key={yearGroup.year} decadeKey={decade.key} yearGroup={yearGroup} />
              ))}
            </MotionList>
          </Reveal>
        ))}
      </div>
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
