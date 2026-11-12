import { RetiredCardFallback } from "@/components/retired-card-fallback";
import { SafetyBadge } from "@/components/safety-badge";
import styles from "@/components/meme-card.module.css";
import type { Locale } from "@/lib/i18n";
import { memePathFrom, type MemeCategory, type SafetyLevel } from "@/lib/labels";
import {
  memeCardArtAlt,
  memeCardArtFromMeme,
  type MemeCardArtSource,
} from "@/lib/meme-card-art";
import { verifiedRetiredCardImage } from "@/lib/retired-card-image";
import type { SocialPlatform } from "@/lib/source-platform";

/**
 * Server-safe poster used by the 410 document.
 * The proxy renders this with `renderToStaticMarkup`, so this module stays free
 * of `"use client"`, `useState`, and `next/link`.
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
  /**
   * 410 document path. Renders a plain anchor and a verified public image
   * (`/ai-memes` or `/images/originals`). Anything else uses `RetiredCardFallback`.
   */
  staticMarkup?: boolean;
  /** Alt text for the 410 verified image. Catalog cards build their own alt. */
  thumbnailAlt?: string;
};

export const MEME_CARD_LINK_CLASS =
  "meme-card-link block min-w-0 rounded-[16px] text-inherit no-underline outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(20,20,20,0.28)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff5c38] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0";

export function memeCardClassName(): string {
  return `${MEME_CARD_LINK_CLASS} ${styles.shell}`;
}

function representativeThumbnail(meme: MemeCardModel): string | null {
  const contents = meme.meme_contents ?? [];
  return (
    contents.find((content) => content.is_representative && content.thumbnail_url)?.thumbnail_url ??
    contents.find((content) => content.thumbnail_url)?.thumbnail_url ??
    null
  );
}

/** Plain-anchor poster. The 410 page always passes `staticMarkup`. */
export function MemeCard({
  meme,
  href,
  locale = "ko",
  titleSize = "grid",
  staticMarkup = false,
  thumbnailAlt,
}: MemeCardProps) {
  const verified = staticMarkup ? verifiedRetiredCardImage(representativeThumbnail(meme)) : null;
  const owned = staticMarkup ? null : memeCardArtFromMeme(meme);
  let art: MemeCardFrameArt;
  if (staticMarkup) {
    art = verified
      ? { kind: "verified", src: verified, alt: thumbnailAlt ?? memeCardArtAlt(meme.title, locale) }
      : { kind: "retired" };
  } else if (owned) {
    art = {
      kind: "owned",
      art: owned,
      sizes: "(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw",
      priority: false,
    };
  } else {
    art = { kind: "poster" };
  }

  return (
    <a
      href={href ?? memePathFrom(meme.short_id, meme.slug)}
      className={memeCardClassName()}
      data-meme-card=""
      data-meme-card-title-size={titleSize}
    >
      <MemeCardFrame
        title={meme.title}
        summary={meme.summary}
        safetyLevel={meme.safety_level}
        year={meme.origin_year}
        locale={locale}
        titleSize={titleSize}
        art={art}
      />
    </a>
  );
}

export type MemeCardFrameArt =
  | {
      kind: "owned";
      art: MemeCardArtSource;
      sizes: string;
      priority: boolean;
      onError?: () => void;
    }
  | { kind: "verified"; src: string; alt: string }
  | { kind: "poster" }
  | { kind: "retired" };

export function MemeCardFrame({
  title,
  summary,
  safetyLevel,
  year,
  locale,
  titleSize,
  art,
}: {
  title: string;
  summary: string;
  safetyLevel?: SafetyLevel | null;
  year?: number | null;
  locale: Locale;
  titleSize: MemeCardTitleSize;
  art: MemeCardFrameArt;
}) {
  const showOwnedBubble = art.kind === "poster";

  return (
    <div className={`${styles.frame} relative aspect-[4/3] overflow-hidden rounded-[16px] bg-[#141414] text-[#f7f4ee]`}>
      <MemeCardArtLayer title={title} locale={locale} art={art} />
      <div
        aria-hidden
        data-meme-card-scrim=""
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom left, rgb(20 20 20 / 0), rgb(20 20 20 / 0.85))",
        }}
      />
      <div className={`${styles.face} ${showOwnedBubble ? styles.fallback : ""} absolute inset-0`}>
        {showOwnedBubble ? (
          <div className={styles.bubbleSlot}>
            <MemeCardBubble />
          </div>
        ) : null}
        <div className={styles.copy}>
          <p
            title={title}
            data-meme-card-title=""
            data-title-size={titleSize}
            className={styles.title}
          >
            {title}
          </p>
          <p title={summary} data-meme-card-summary="" className={styles.summary}>
            {summary}
          </p>
          <div className={styles.badges}>
            {safetyLevel ? (
              <span className={styles.safety}>
                <SafetyBadge level={safetyLevel} locale={locale} />
              </span>
            ) : null}
            {year != null ? (
              <span className={`${styles.year} inline-flex items-center rounded-full bg-[#141414] px-2.5 py-1 text-[13px] font-semibold tabular-nums text-white ring-1 ring-white/70`}>
                {year}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemeCardArtLayer({
  title,
  locale,
  art,
}: {
  title: string;
  locale: Locale;
  art: MemeCardFrameArt;
}) {
  switch (art.kind) {
    case "owned":
      return (
        // Owned storage is same-origin. Widths are explicit, so next/image is unnecessary.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art.art.src}
          srcSet={art.art.srcSet}
          sizes={art.sizes}
          width={art.art.width}
          height={art.art.height}
          alt={memeCardArtAlt(title, locale)}
          loading={art.priority ? "eager" : "lazy"}
          fetchPriority={art.priority ? "high" : undefined}
          decoding="async"
          draggable={false}
          onError={art.onError}
          data-meme-card-art="image"
          className="absolute inset-0 h-full w-full object-cover"
        />
      );
    case "verified":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art.src}
          alt={art.alt}
          data-thumbnail-state="image"
          data-meme-card-art="image"
          className="absolute inset-0 h-full w-full object-cover"
        />
      );
    case "retired":
      return <RetiredCardFallback />;
    case "poster":
      return <div aria-hidden data-meme-card-art="fallback" className="absolute inset-0 bg-[#141414]" />;
    default: {
      const unreachable: never = art;
      return unreachable;
    }
  }
}

function MemeCardBubble() {
  return (
    <svg
      viewBox="0 0 120 80"
      className={styles.bubble}
      aria-hidden
      data-meme-card-bubble=""
      focusable="false"
    >
      <path
        fill="#ff5c38"
        d="M8 6h78a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H42L26 74V58H8a8 8 0 0 1-8-8V14a8 8 0 0 1 8-8z"
      />
    </svg>
  );
}
