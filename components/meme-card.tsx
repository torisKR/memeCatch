"use client";

import Link from "next/link";
import { useState } from "react";
import { SafetyBadge } from "@/components/safety-badge";
import type { Locale } from "@/lib/i18n";
import { memePathFrom, type MemeCategory, type SafetyLevel } from "@/lib/labels";
import {
  memeCardArtAlt,
  memeCardArtFromMeme,
  type MemeCardArtSource,
} from "@/lib/meme-card-art";
import type { SocialPlatform } from "@/lib/source-platform";

/**
 * Shared poster card (Direction B).
 *
 * Art fills the 4:3 frame. Charcoal (#141414) fades to 85% at the bottom-left,
 * and the title, one-line summary, usage signal, and year sit in a 24px inset.
 * Missing 4:3 art uses the charcoal speech-bubble fallback. YouTube stills are
 * never a card image. A later art file only changes `card_art_url` or an owned
 * `/api/media/meme-card-art/` thumbnail — the chrome stays the same.
 *
 * `imageAspect`, `rank`, and `sourcePlatform` stay on the props so existing
 * callers (including the retired-product page) keep typechecking. The poster
 * is always 4:3 and only shows the usage signal and year.
 */
export type MemeCardTitleSize = "grid" | "detail";

export type MemeCardModel = {
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  category: MemeCategory;
  safety_level: SafetyLevel;
  origin_year?: number | null;
  card_art_url?: string | null;
  meme_contents?: ReadonlyArray<{
    thumbnail_url?: string | null;
    is_representative?: boolean | null;
  }> | null;
};

export type MemeCardProps = {
  meme: MemeCardModel;
  href?: string;
  priority?: boolean;
  rank?: number;
  sourcePlatform?: SocialPlatform;
  locale?: Locale;
  titleSize?: MemeCardTitleSize;
  /** Accepted for callers that still pass it. The poster is always 4:3. */
  imageAspect?: "4/3" | "4/5";
};

const CARD_LINK =
  "meme-card-link block h-full min-w-0 rounded-[16px] text-inherit no-underline outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,20,20,0.28)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5c38] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0";

export function MemeCard({
  meme,
  href,
  priority = false,
  locale = "ko",
  titleSize = "grid",
}: MemeCardProps) {
  const art = memeCardArtFromMeme(meme);
  return (
    <Link
      href={href ?? memePathFrom(meme.short_id, meme.slug)}
      className={CARD_LINK}
      data-meme-card=""
      data-meme-card-title-size={titleSize}
    >
      <MemeCardFace
        title={meme.title}
        summary={meme.summary}
        safetyLevel={meme.safety_level}
        year={meme.origin_year}
        locale={locale}
        art={art}
        priority={priority}
        titleSize={titleSize}
      />
    </Link>
  );
}

export function MemeCardFace({
  title,
  summary,
  safetyLevel,
  year,
  locale = "ko",
  art,
  priority = false,
  titleSize = "grid",
}: {
  title: string;
  summary: string;
  safetyLevel?: SafetyLevel | null;
  year?: number | null;
  locale?: Locale;
  art: MemeCardArtSource | null;
  priority?: boolean;
  titleSize?: MemeCardTitleSize;
}) {
  const titleClass =
    titleSize === "detail"
      ? "text-[28px] leading-[1.15]"
      : "text-[20px] leading-[1.25]";
  const sizes =
    titleSize === "detail"
      ? "(min-width: 1024px) 360px, 100vw"
      : "(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw";

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-[16px] bg-[#141414] text-[#f7f4ee]">
      <MemeCardMedia
        art={art}
        alt={art ? memeCardArtAlt(title, locale) : ""}
        priority={priority}
        sizes={sizes}
      />
      <div className="absolute inset-0 z-10 flex flex-col justify-end gap-2 p-6">
        <p title={title} className={`line-clamp-2 font-extrabold tracking-tight ${titleClass}`}>
          {title}
        </p>
        <p title={summary} className="line-clamp-1 text-[14px] leading-5 text-[#f7f4ee]">
          {summary}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {safetyLevel ? <SafetyBadge level={safetyLevel} locale={locale} /> : null}
          {year != null ? (
            <span className="inline-flex items-center rounded-full bg-[#141414] px-2.5 py-1 text-[13px] font-semibold tabular-nums text-white ring-1 ring-white/70">
              {year}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MemeCardMedia({
  art,
  alt,
  priority,
  sizes,
}: {
  art: MemeCardArtSource | null;
  alt: string;
  priority: boolean;
  sizes: string;
}) {
  const [failed, setFailed] = useState(false);
  const showArt = Boolean(art && !failed);

  return (
    <>
      {showArt && art ? (
        // Owned storage is same-origin. Widths are explicit, so next/image is unnecessary.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art.src}
          srcSet={art.srcSet}
          sizes={sizes}
          width={art.width}
          height={art.height}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          data-meme-card-art="image"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <MemeCardFallback />
      )}
      <div
        aria-hidden
        data-meme-card-scrim=""
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom left, rgb(20 20 20 / 0), rgb(20 20 20 / 0.85))",
        }}
      />
    </>
  );
}

function MemeCardFallback() {
  return (
    <div aria-hidden data-meme-card-art="fallback" className="absolute inset-0 bg-[#141414]">
      <svg
        viewBox="0 0 120 80"
        className="absolute left-6 top-6 h-[38%] w-[58%]"
        focusable="false"
      >
        <path
          fill="#ff5c38"
          d="M8 6h78a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H42L26 74V58H8a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z"
        />
      </svg>
    </div>
  );
}
