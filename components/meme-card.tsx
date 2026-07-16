"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { memePathFrom } from "@/lib/labels";
import { CategoryTag } from "@/components/category-tag";
import { SafetyBadge } from "@/components/safety-badge";
import { LifeGauge } from "@/components/life-gauge";
import type { MemeListItem, MemeRow } from "@/lib/queries";
import {
  SOURCE_PLATFORM_META,
  sourcePlatformsFromMeme,
  type SourcePlatform,
} from "@/lib/source-platform";

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
  rank,
}: {
  meme: MemeRow | MemeListItem;
  /** 링크 오버라이드 — 컬렉션 맥락 파라미터(?ctx=...) 부착용 */
  href?: string;
  /** above-the-fold 카드면 true — 썸네일을 즉시 로드해 LCP 개선. 첫 행에만 준다. */
  priority?: boolean;
  /** 급상승 차트 순위(1부터) — 미디어 좌하단 대형 숫자. 순위가 실제 정보인 곳에서만. */
  rank?: number;
}) {
  const reduce = useReducedMotion();
  const contents = "meme_contents" in meme ? (meme.meme_contents ?? []) : [];
  const thumb =
    contents.find((c) => c.is_representative && c.thumbnail_url)?.thumbnail_url ??
    contents.find((c) => c.thumbnail_url)?.thumbnail_url ??
    null;
  const sourcePlatforms = sourcePlatformsFromMeme({
    contents,
    sources: "meme_sources" in meme ? meme.meme_sources : [],
  });

  return (
    <MotionLink
      href={href ?? memePathFrom(meme.short_id, meme.slug)}
      // relative 필수: sr-only(absolute) 등 내부 absolute 요소의 포지셔닝 조상을
      // 카드로 고정 — 없으면 캐러셀 래퍼까지 탈출해 문서 가로 스크롤을 만든다.
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm transition-shadow duration-300 hover:shadow-xl focus-visible:outline-offset-4"
      whileHover={reduce ? undefined : { y: -4, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {/* 미디어 4:5 — aspect 예약으로 CLS 방지. shrink-0으로 카드 높이 통일 시에도 비율 유지 */}
      <div className="relative aspect-[4/5] shrink-0 overflow-hidden bg-surface-2">
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
          // 타이포 플레이스홀더 — "비어 있는 회색"이 아니라 의도된 타이포 카드로:
          // 좌상단 큰따옴표 워터마크(저불투명) + 제목 타이포 + 우하단 등장연도 칩.
          <div
            aria-hidden
            className="relative flex h-full w-full flex-col justify-end gap-2 p-3.5"
            style={{
              background: `var(--cat-${meme.category}-bg)`,
              color: `var(--cat-${meme.category}-text)`,
            }}
          >
            {/* 큰따옴표 SVG 워터마크 — 상단 오버레이 칩 아래로 살짝 비껴 배치 */}
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
              className="pointer-events-none absolute left-2 top-8 h-16 w-16 opacity-[0.14]"
            >
              <path d="M10.6 4.9C6.8 7.1 4.6 10.3 4.6 14.2c0 2.8 1.7 4.6 4 4.6 2 0 3.6-1.5 3.6-3.6 0-2-1.4-3.3-3.2-3.3-.3 0-.7 0-.9.1.4-2 2.1-4 4-5.2L10.6 4.9Zm8.9 0c-3.9 2.2-6 5.4-6 9.3 0 2.8 1.7 4.6 4 4.6 2 0 3.5-1.5 3.5-3.6 0-2-1.3-3.3-3.1-3.3-.3 0-.7 0-.9.1.4-2 2-4 4-5.2L19.5 4.9Z" />
            </svg>
            <span className="relative line-clamp-4 text-xl font-extrabold leading-snug">
              {meme.title}
            </span>
            {/* 연도 칩 — 우하단 스탬프. 좌하단 rank 대형 숫자 오버레이와 충돌 회피 */}
            {meme.origin_year != null && (
              <span className="relative inline-flex items-center self-end rounded-full border border-current/30 px-2 py-0.5 text-[11px] font-bold tabular-nums tracking-tight">
                {meme.origin_year}
              </span>
            )}
          </div>
        )}

        {/* 상단 오버레이: 카테고리 틴트칩(좌) + 미디어타입(우) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex min-w-0 items-start justify-between gap-1.5 p-2.5">
          <CategoryTag category={meme.category} className="shadow-sm" />
          <div className="flex min-w-0 flex-col items-end gap-1">
            {sourcePlatforms.slice(0, 2).map((platform) => (
              <SourcePlatformBadge key={platform} platform={platform} />
            ))}
            {sourcePlatforms.length > 2 && (
              <span className="inline-flex items-center rounded-full border border-border/70 bg-surface/90 px-2 py-1 text-[11px] font-bold text-muted shadow-sm backdrop-blur-sm">
                +{sourcePlatforms.length - 2}
              </span>
            )}
            <MediaTypeBadge type={meme.media_type} />
          </div>
        </div>

        {/* 급상승 차트 순위 — 좌하단 대형 숫자(1~3위 불꽃 그라디언트). 순위=정보인 맥락 전용 */}
        {rank != null && (
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-1 left-2.5 select-none text-[2.75rem] font-black italic leading-none tracking-tighter tabular-nums ${
              rank <= 3 ? "text-transparent" : "text-white/95"
            }`}
            style={
              rank <= 3
                ? {
                    backgroundImage:
                      "linear-gradient(160deg, var(--flame-300) 0%, var(--flame-500) 55%, var(--flame-700) 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.45))",
                  }
                : { filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.55))" }
            }
          >
            {rank}
          </span>
        )}
      </div>

      {/* 본문 — flex-1 + footer mt-auto로 카드 높이를 통일(제목·요약 길이 무관) */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
        {rank != null && <span className="sr-only">{rank}위</span>}
        {/* 밈명 — 텍스트가 주인공. 2줄 높이 고정(min-h)으로 카드 간 들쭉날쭉 방지 */}
        <p className="line-clamp-2 min-h-[2.75em] break-keep text-lg font-extrabold leading-snug">
          {meme.title}
        </p>
        {/* 한 줄 뜻 — 2줄 높이 고정 */}
        <p className="line-clamp-2 min-h-[3.25em] break-keep text-sm leading-relaxed text-muted">
          {meme.summary}
        </p>
        {/* 구분선 + 하단 신호등(고채도 독점) + 생명 게이지 — 항상 카드 바닥에 정렬 */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 border-t border-border pt-2.5">
          <SafetyBadge level={meme.safety_level} />
          <LifeGauge status={meme.lifecycle_status} size="sm" showLabel={false} />
        </div>
      </div>
    </MotionLink>
  );
}

function SourcePlatformBadge({ platform }: { platform: SourcePlatform }) {
  const tone: Record<SourcePlatform, string> = {
    youtube: "border-red-200 bg-red-50/95 text-red-700",
    youtube_shorts: "border-rose-200 bg-rose-50/95 text-rose-700",
    tiktok: "border-cyan-200 bg-cyan-50/95 text-cyan-800",
    instagram: "border-fuchsia-200 bg-fuchsia-50/95 text-fuchsia-800",
    community: "border-border/70 bg-surface/90 text-foreground",
    other: "border-border/70 bg-surface/90 text-foreground",
  };
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[11px] font-bold tracking-tight shadow-sm backdrop-blur-sm ${tone[platform]}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {SOURCE_PLATFORM_META[platform].label}
    </span>
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
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-border/70 bg-surface/85 px-2 py-1 text-xs font-semibold text-muted shadow-sm backdrop-blur-sm">
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
