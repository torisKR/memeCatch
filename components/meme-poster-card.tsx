"use client";

import Image from "next/image";
import { useState } from "react";
import type { SeoRouteLocale } from "@/lib/i18n-routing";
import type { SafetyLevel } from "@/lib/labels";
import {
  POSTER_CREAM,
  POSTER_ORANGE,
  isPublicMemeArtPath,
  memeArtAlt,
  posterBadgeLabel,
  posterBadgeTone,
} from "@/lib/meme-poster";

type PosterHeading = "h1" | "p";
type PosterSize = "grid" | "detail";

export function MemePosterCard({
  title,
  summary,
  safetyLevel,
  year,
  artUrl,
  size,
  locale,
  priority = false,
  heading = "p",
  summaryId,
}: {
  title: string;
  summary: string;
  safetyLevel: SafetyLevel;
  year?: number | null;
  artUrl?: string | null;
  size: PosterSize;
  locale: SeoRouteLocale;
  priority?: boolean;
  heading?: PosterHeading;
  summaryId?: string;
}) {
  const tone = posterBadgeTone(safetyLevel);
  const Title = heading === "h1" ? "h1" : "p";
  const titleSize = size === "detail" ? 28 : 20;

  return (
    <div
      data-meme-poster=""
      data-poster-size={size}
      className="relative aspect-[4/3] w-full overflow-hidden rounded-[16px] bg-[#141414]"
    >
      <PosterArt
        src={isPublicMemeArtPath(artUrl) ? artUrl : null}
        alt={memeArtAlt(title)}
        priority={priority}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(20,20,20,0.85), rgba(20,20,20,0))" }}
      />
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            data-safety-icon={safetyLevel}
            className="inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-bold leading-none"
            style={{ backgroundColor: tone.background, color: tone.foreground }}
          >
            {posterBadgeLabel(safetyLevel, locale)}
          </span>
          {typeof year === "number" ? (
            <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-[13px] font-bold leading-none text-[#F4EFE6]">
              {year}
            </span>
          ) : null}
        </div>
        <Title
          className="line-clamp-2 max-w-full font-black leading-tight text-[#F4EFE6]"
          style={{ fontSize: titleSize }}
        >
          {title}
        </Title>
        <p
          id={summaryId}
          className="line-clamp-1 max-w-full font-medium leading-snug"
          style={{ fontSize: 14, color: POSTER_CREAM }}
        >
          {summary}
        </p>
      </div>
    </div>
  );
}

function PosterArt({
  src,
  alt,
  priority,
}: {
  src?: string | null;
  alt: string;
  priority: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div data-meme-art="fallback" className="absolute inset-0">
        <svg
          aria-hidden
          viewBox="0 0 640 480"
          className="h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <rect width="640" height="480" fill="#141414" />
          <path
            fill={POSTER_ORANGE}
            d="M430 36h150c26 0 48 22 48 48v132c0 26-22 48-48 48h-46l-22 40-6-40h-76c-26 0-48-22-48-48V84c0-26 22-48 48-48z"
          />
          <circle cx="92" cy="72" r="8" fill={POSTER_CREAM} opacity="0.8" />
          <circle cx="118" cy="72" r="4" fill={POSTER_CREAM} opacity="0.45" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      data-meme-art="image"
      src={src}
      alt={alt}
      width={640}
      height={480}
      sizes="(min-width: 64rem) 25vw, 100vw"
      loading={priority ? "eager" : "lazy"}
      className="absolute inset-0 h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}
