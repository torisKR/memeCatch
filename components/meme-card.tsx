import Link from "next/link";
import { CategoryTag } from "@/components/category-tag";
import { CountryFlagBadge } from "@/components/country-flag-badge";
import { MemeThumbnail } from "@/components/meme-thumbnail";
import { SafetyIcon } from "@/components/safety-icon";
import {
  LIFECYCLE_STATUS,
  SAFETY_LEVELS,
  memePathFrom,
  type SafetyLevel,
} from "@/lib/labels";
import type { MemeListItem, MemeRow } from "@/lib/queries";
import { originCountryCode, type MemeCountryLocale } from "@/lib/meme-country";
import {
  SOURCE_PLATFORM_META,
  type SocialPlatform,
} from "@/lib/source-platform";

const SAFETY_TONE: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

/**
 * 기본 탐색 카드.
 *
 * 카드의 주인공은 이미지·이름·한 줄 설명이다. 플랫폼과 미디어 타입을 모두
 * 겹쳐 보이던 이전 UI 대신, 플랫폼 필터 문맥에서만 출처 하나를 표시한다.
 */
export function MemeCard({
  meme,
  href,
  priority = false,
  rank,
  sourcePlatform,
  locale = "ko",
}: {
  meme: MemeRow | MemeListItem;
  href?: string;
  priority?: boolean;
  rank?: number;
  sourcePlatform?: SocialPlatform;
  locale?: MemeCountryLocale;
}) {
  const contents = "meme_contents" in meme ? (meme.meme_contents ?? []) : [];
  const thumb =
    contents.find((content) => content.is_representative && content.thumbnail_url)
      ?.thumbnail_url ??
    contents.find((content) => content.thumbnail_url)?.thumbnail_url ??
    null;
  const countryCode = originCountryCode(
    (meme as MemeListItem).meme_market_profiles,
  );

  return (
    <Link
      href={href ?? memePathFrom(meme.short_id, meme.slug)}
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors duration-200 hover:border-accent/60 motion-reduce:transition-none focus-visible:outline-offset-4"
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-surface-2">
        <MemeThumbnail
          src={thumb}
          title={meme.title}
          category={meme.category}
          originYear={meme.origin_year}
          priority={priority}
        />

        <div
          data-country-flag-position="top-right"
          className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2"
        >
          <div className="min-w-0">
            <CategoryTag category={meme.category} />
          </div>
          {(countryCode || sourcePlatform) && (
            <div className="flex min-w-0 flex-col items-end gap-1.5">
              {countryCode && <CountryFlagBadge code={countryCode} locale={locale} />}
              {sourcePlatform && <SourcePlatformBadge platform={sourcePlatform} />}
            </div>
          )}
        </div>

        {rank != null && (
          <span
            className={`pointer-events-none absolute bottom-2 left-2 inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-extrabold tabular-nums ${
              rank <= 3
                ? "border-accent/30 bg-surface/95 text-accent"
                : "border-border bg-surface/95 text-foreground"
            }`}
          >
            {rank}위
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        {/* line-clamp로 잘린 긴 제목의 전체 텍스트 접근 경로(title 툴팁) — LOOP.md §6 */}
        <p
          title={meme.title}
          className="line-clamp-2 break-keep text-base font-extrabold leading-snug"
        >
          {meme.title}
        </p>
        <p className="line-clamp-1 break-keep text-sm leading-relaxed text-muted">
          {meme.summary}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 pt-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${SAFETY_TONE[meme.safety_level]}`}
          >
            <SafetyIcon level={meme.safety_level} className="size-3.5" />
            {SAFETY_LEVELS[meme.safety_level].user}
          </span>
          <span className="text-xs font-semibold text-muted">
            {LIFECYCLE_STATUS[meme.lifecycle_status].user}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SourcePlatformBadge({ platform }: { platform: SocialPlatform }) {
  const tone: Record<SocialPlatform, string> = {
    youtube: "border-red-200 bg-red-50/95 text-red-700",
    youtube_shorts: "border-rose-200 bg-rose-50/95 text-rose-700",
    tiktok: "border-cyan-200 bg-cyan-50/95 text-cyan-800",
    instagram: "border-fuchsia-200 bg-fuchsia-50/95 text-fuchsia-800",
  };

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-bold shadow-sm backdrop-blur-sm ${tone[platform]}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {SOURCE_PLATFORM_META[platform].label}
    </span>
  );
}
