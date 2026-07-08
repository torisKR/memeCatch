"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { memePathFrom, type MemeCategory } from "@/lib/labels";
import { SafetyBadge } from "@/components/safety-badge";
import { LifeGauge } from "@/components/life-gauge";
import type { MemeListItem, MemeRow } from "@/lib/queries";

/**
 * 밈 카드 — 3단 위계 (DESIGN.md §6):
 *   ① 밈명 + 한 줄 뜻 (텍스트가 주인공, 18px)
 *   ② 신호등 배지 1개 + 생명 게이지 소형
 *   ③ 썸네일 4:5 (없으면 카테고리 컬러 플레이스홀더 + 밈명 타이포)
 * 호버: y-4 / scale1.02 / 그림자 상승, 프레스: scale0.97. 전체 클릭 영역.
 * reduced-motion에서는 트랜스폼 애니메이션을 끈다.
 */
const CATEGORY_TONE: Record<MemeCategory, string> = {
  phrase: "var(--accent)",
  dance: "var(--life-active)",
  song: "var(--sent-controversial)",
  image: "var(--safety-green)",
  comment: "var(--life-cooling)",
  challenge: "var(--safety-red)",
};

const MotionLink = motion.create(Link);

export function MemeCard({ meme }: { meme: MemeRow | MemeListItem }) {
  const reduce = useReducedMotion();
  const contents = "meme_contents" in meme ? (meme.meme_contents ?? []) : [];
  const thumb =
    contents.find((c) => c.is_representative && c.thumbnail_url)?.thumbnail_url ??
    contents.find((c) => c.thumbnail_url)?.thumbnail_url ??
    null;
  const tone = CATEGORY_TONE[meme.category];

  return (
    <MotionLink
      href={memePathFrom(meme.short_id, meme.slug)}
      className="group block min-w-0 rounded-2xl focus-visible:outline-offset-4"
      whileHover={reduce ? undefined : { y: -4, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* ③ 썸네일 4:5 — aspect 예약으로 CLS 방지 */}
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-sm transition-shadow duration-300 group-hover:shadow-xl">
        {thumb ? (
          // 원격 도메인이 다양해 next/image remotePatterns 대신 img 사용
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
              background: `color-mix(in srgb, ${tone} 14%, var(--surface-2))`,
            }}
          >
            <span
              className="line-clamp-4 text-lg font-extrabold leading-snug"
              style={{ color: tone }}
            >
              {meme.title}
            </span>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex flex-col gap-1.5">
        {/* ① 밈명 + 한 줄 뜻 */}
        <p className="line-clamp-2 text-lg font-bold leading-snug">{meme.title}</p>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
          {meme.summary}
        </p>
        {/* ② 신호등 배지 1개 + 생명 게이지 소형 */}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <SafetyBadge level={meme.safety_level} />
          <LifeGauge status={meme.lifecycle_status} size="sm" />
        </div>
      </div>
    </MotionLink>
  );
}
