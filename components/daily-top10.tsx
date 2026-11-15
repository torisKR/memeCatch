"use client";

import type { MemeListItem } from "@/lib/queries";
import { HScrollSection } from "@/components/h-scroll";
import { MemeCard } from "@/components/meme-card";
import { MotionList } from "@/components/motion-list";
import { hasPublicListing } from "@/lib/thin-meme";

/**
 * 오늘 많이 본 밈 TOP 10 — 탐색 기본 진입 상태에서 그리드 위 가로 스크롤 스트립.
 * 데이터는 서버(get_daily_top_memes RPC)가 내려준다(오늘 KST 조회수 desc,
 * 부족분은 trend_score desc로 채움).
 *
 * 스트립 셸(스크롤바 숨김/양끝 페이드/데스크톱 화살표)은 HScrollSection,
 * 카드는 탐색과 같은 MemeCard를 쓴다.
 * 진입 스태거는 MotionList(DESIGN §5) 유지.
 */
export function DailyTop10({ memes }: { memes: MemeListItem[] }) {
  if (!hasPublicListing(memes.length)) return null;
  return (
    <HScrollSection
      headingId="daily-top10-heading"
      heading={
        <>
          오늘 많이 본 밈 <span className="text-accent">TOP 10</span> <span
            aria-hidden
            className="inline-flex items-center gap-1 rounded-full border border-signal-cyan/25 bg-signal-cyan-soft px-1.5 py-1 align-middle"
          >
            <span className="signal-live size-1.5 rounded-full bg-signal-cyan" />
          </span>
        </>
      }
      className="mt-8"
    >
      <MotionList
        as="ul"
        itemAs="li"
        className="instrument-grid flex w-max gap-4"
        itemClassName="w-64 min-w-0 shrink-0 snap-start"
      >
        {memes.slice(0, 10).map((meme, i) => (
          <MemeCard key={meme.id} meme={meme} priority={i < 2} />
        ))}
      </MotionList>
    </HScrollSection>
  );
}
