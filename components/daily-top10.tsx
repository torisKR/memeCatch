"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { memePathFrom } from "@/lib/labels";
import type { MemeListItem } from "@/lib/queries";
import { SafetyBadge } from "@/components/safety-badge";
import { MotionList } from "@/components/motion-list";

/**
 * 오늘 많이 본 밈 TOP 10 — 탐색 기본 진입 상태에서 그리드 위 가로 스크롤 스트립.
 * 데이터는 서버(get_daily_top_memes RPC)가 내려준다(오늘 KST 조회수 desc,
 * 부족분은 trend_score desc로 채움).
 *
 * DESIGN §5/§11 준수: 진입 스태거(MotionList), 호버 y-4/scale1.02, 프레스 0.97,
 * spring {400,25}, reduced-motion 존중. 순위 뱃지는 1~3위만 accent(고채도는
 * 신호등 독점 원칙이 있으나 순위 강조는 브랜드 accent 단일 포인트로 한정).
 */

const MotionLink = motion.create(Link);

export function DailyTop10({ memes }: { memes: MemeListItem[] }) {
  if (memes.length === 0) return null;
  return (
    <section aria-labelledby="daily-top10-heading" className="mt-8">
      <h2 id="daily-top10-heading" className="text-xl font-bold">
        오늘 많이 본 밈 <span className="text-accent">TOP 10</span>
      </h2>
      <MotionList
        as="ul"
        itemAs="li"
        className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2"
        itemClassName="w-36 min-w-0 shrink-0 snap-start sm:w-40"
      >
        {memes.slice(0, 10).map((meme, i) => (
          <Top10Card key={meme.id} meme={meme} rank={i + 1} />
        ))}
      </MotionList>
    </section>
  );
}

/** 콤팩트 카드 — MemeCard의 축약형(순위 뱃지 + 썸네일 + 밈명 + 신호등) */
function Top10Card({ meme, rank }: { meme: MemeListItem; rank: number }) {
  const reduce = useReducedMotion();
  const contents = meme.meme_contents ?? [];
  const thumb =
    contents.find((c) => c.is_representative && c.thumbnail_url)?.thumbnail_url ??
    contents.find((c) => c.thumbnail_url)?.thumbnail_url ??
    null;
  const top3 = rank <= 3;

  return (
    <MotionLink
      href={memePathFrom(meme.short_id, meme.slug)}
      className="group block min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow duration-300 hover:shadow-xl focus-visible:outline-offset-4"
      whileHover={reduce ? undefined : { y: -4, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
        {thumb ? (
          // 원격 도메인이 다양해 next/image remotePatterns 대신 img 사용(MemeCard와 동일)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-end p-3"
            style={{
              background: `var(--cat-${meme.category}-bg)`,
              color: `var(--cat-${meme.category}-text)`,
            }}
          >
            <span className="line-clamp-3 text-base font-extrabold leading-snug">
              {meme.title}
            </span>
          </div>
        )}

        {/* 순위 뱃지 — 1~3위 accent 강조, 4위 이하 중립 표면 */}
        <span
          aria-hidden
          className={`absolute left-2 top-2 grid size-7 place-items-center rounded-full text-sm font-extrabold shadow-sm ${
            top3
              ? "bg-accent-strong text-white"
              : "border border-border/70 bg-surface/85 text-foreground backdrop-blur-sm"
          }`}
        >
          {rank}
        </span>
        <span className="sr-only">{rank}위</span>
      </div>

      <div className="flex flex-col items-start gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-extrabold leading-snug">
          {meme.title}
        </p>
        <SafetyBadge level={meme.safety_level} />
      </div>
    </MotionLink>
  );
}
