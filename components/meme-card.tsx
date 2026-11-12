"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MemeCard as PosterMemeCard,
  MemeCardFrame,
  memeCardClassName,
  type MemeCardFrameArt,
  type MemeCardModel,
  type MemeCardProps,
  type MemeCardTitleSize,
} from "@/components/meme-card-poster";
import { memeCardArtFromMeme, type MemeCardArtSource } from "@/lib/meme-card-art";
import type { Locale } from "@/lib/i18n";
import { memePathFrom, type SafetyLevel } from "@/lib/labels";

export type { MemeCardModel, MemeCardProps, MemeCardTitleSize };

/**
 * Catalog poster. The 410 page imports the server poster directly so the proxy
 * can render it. This client entry adds the link and the image error fallback.
 */
export function MemeCard(props: MemeCardProps) {
  if (props.staticMarkup) return <PosterMemeCard {...props} />;
  const { meme, href, priority = false, locale = "ko", titleSize = "grid" } = props;

  return (
    <Link
      href={href ?? memePathFrom(meme.short_id, meme.slug)}
      className={memeCardClassName()}
      data-meme-card=""
      data-meme-card-title-size={titleSize}
    >
      <MemeCardFace
        title={meme.title}
        summary={meme.summary}
        safetyLevel={meme.safety_level}
        year={meme.origin_year}
        locale={locale}
        art={memeCardArtFromMeme(meme)}
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
  const [failed, setFailed] = useState(false);
  const sizes =
    titleSize === "detail"
      ? "(min-width: 1024px) 360px, 100vw"
      : "(min-width: 1280px) 280px, (min-width: 768px) 33vw, 50vw";
  const frameArt: MemeCardFrameArt =
    art && !failed
      ? { kind: "owned", art, sizes, priority, onError: () => setFailed(true) }
      : { kind: "poster" };

  return (
    <MemeCardFrame
      title={title}
      summary={summary}
      safetyLevel={safetyLevel}
      year={year}
      locale={locale}
      titleSize={titleSize}
      art={frameArt}
    />
  );
}
