"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { memePathFrom } from "@/lib/labels";
import { CategoryTag } from "@/components/category-tag";
import { SafetyBadge } from "@/components/safety-badge";
import { LifeGauge } from "@/components/life-gauge";
import type { MemeListItem, MemeRow } from "@/lib/queries";

/**
 * 밈 카드 — DESIGN §11 카드 스펙 v2 (검증 반영):
 *   상단: 카테고리 소프트 틴트칩 + 미디어타입(중립 아이콘) — 미디어 위 오버레이
 *   본문: 밈명(18px 800, 주인공) → 한 줄 뜻(muted 2줄) → 구분선
 *   하단: 신호등 배지(고채도 독점) + 생명 게이지 소형
 * 위계: 카테고리 틴트는 저채도라 신호등(1급 시그널)을 침범하지 않음.
 * 호버 y-4/scale1.02·프레스 scale0.97·진입 스태거 유지. 전체 클릭 영역.
 * 썸네일 없으면 카테고리 틴트 배경 플레이스홀더 + 밈명 타이포.
 * reduced-motion에서는 트랜스폼 애니메이션을 끈다.
 */
const MotionLink = motion.create(Link);

export function MemeCard({
  meme,
  href,
  priority = false,
}: {
  meme: MemeRow | MemeListItem;
  /** 링크 오버라이드 — 컬렉션 맥락 파라미터(?ctx=...) 부착용 */
  href?: string;
  /** above-the-fold 카드면 true — 썸네일을 즉시 로드해 LCP 개선. 첫 행에만 준다. */
  priority?: boolean;
}) {
  const reduce = useReducedMotion();
  const contents = "meme_contents" in meme ? (meme.meme_contents ?? []) : [];
  const thumb =
    contents.find((c) => c.is_representative && c.thumbnail_url)?.thumbnail_url ??
    contents.find((c) => c.thumbnail_url)?.thumbnail_url ??
    null;

  return (
    <MotionLink
      href={href ?? memePathFrom(meme.short_id, meme.slug)}
      className="group block min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow duration-300 hover:shadow-xl focus-visible:outline-offset-4"
      whileHover={reduce ? undefined : { y: -4, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* 미디어 4:5 — aspect 예약으로 CLS 방지 */}
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
        {thumb ? (
          // 원격 도메인이 다양해 next/image remotePatterns 대신 img 사용
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt=""
            // above-the-fold(priority) 카드는 즉시 로드해 LCP를 앞당긴다.
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-full w-full items-end p-3.5"
            style={{
              background: `var(--cat-${meme.category}-bg)`,
              color: `var(--cat-${meme.category}-text)`,
            }}
          >
            <span className="line-clamp-4 text-xl font-extrabold leading-snug">
              {meme.title}
            </span>
          </div>
        )}

        {/* 상단 오버레이: 카테고리 틴트칩(좌) + 미디어타입(우) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <CategoryTag category={meme.category} className="shadow-sm" />
          <MediaTypeBadge type={meme.media_type} />
        </div>
      </div>

      {/* 본문 */}
      <div className="flex flex-col gap-1.5 p-3.5">
        {/* 밈명 — 텍스트가 주인공 */}
        <p className="line-clamp-2 text-lg font-extrabold leading-snug">
          {meme.title}
        </p>
        {/* 한 줄 뜻 */}
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">
          {meme.summary}
        </p>
        {/* 구분선 + 하단 신호등(고채도 독점) + 생명 게이지 */}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-border pt-2.5">
          <SafetyBadge level={meme.safety_level} />
          <LifeGauge status={meme.lifecycle_status} size="sm" showLabel={false} />
        </div>
      </div>
    </MotionLink>
  );
}

/** 미디어 타입 배지 — 중립 stroke 아이콘 + 짧은 라벨(반투명 표면 위) */
const MEDIA_META: Record<
  MemeRow["media_type"],
  { label: string; glyph: React.ReactNode }
> = {
  video: {
    label: "영상",
    glyph: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M10 9.2v5.6l5-2.8z" fill="currentColor" stroke="none" />
      </>
    ),
  },
  image: {
    label: "이미지",
    glyph: (
      <>
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.4" />
        <path d="m4 17 5-4.5L14 17l3-2.5 3 2.5" />
      </>
    ),
  },
  audio: {
    label: "오디오",
    glyph: (
      <>
        <path d="M5 10v4M9 7v10M13 9v6M17 6v12M21 10v4" />
      </>
    ),
  },
  embed: {
    label: "임베드",
    glyph: (
      <>
        <path d="m9 8-5 4 5 4M15 8l5 4-5 4" />
      </>
    ),
  },
  text: {
    label: "글",
    glyph: (
      <>
        <path d="M5 6h14M5 12h14M5 18h9" />
      </>
    ),
  },
};

function MediaTypeBadge({ type }: { type: MemeRow["media_type"] }) {
  const meta = MEDIA_META[type];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface/85 px-2 py-1 text-xs font-semibold text-muted shadow-sm backdrop-blur-sm">
      <svg
        viewBox="0 0 24 24"
        className="size-3.5 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {meta.glyph}
      </svg>
      {meta.label}
    </span>
  );
}
