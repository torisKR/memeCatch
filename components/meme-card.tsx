import Link from "next/link";
import { CategoryTag } from "@/components/category-tag";
import { CountryFlagBadge } from "@/components/country-flag-badge";
import { MemeThumbnail } from "@/components/meme-thumbnail";
import { SafetyBadge } from "@/components/safety-badge";
import { memePathFrom } from "@/lib/labels";
import type { MemeListItem, MemeRow } from "@/lib/queries";
import { originCountryCode } from "@/lib/meme-country";
import {
  SOURCE_PLATFORM_META,
  type SocialPlatform,
} from "@/lib/source-platform";

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
}: {
  meme: MemeRow | MemeListItem;
  href?: string;
  priority?: boolean;
  rank?: number;
  sourcePlatform?: SocialPlatform;
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
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-accent/60 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-offset-4"
    >
      <div className="relative aspect-[4/5] shrink-0 overflow-hidden bg-surface-2">
        <MemeThumbnail
          src={thumb}
          title={meme.title}
          fallbackCaption={meme.summary}
          category={meme.category}
          originYear={meme.origin_year}
          priority={priority}
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <div data-country-flag-position="top-left" className="flex flex-col items-start gap-1.5">
            <CountryFlagBadge code={countryCode} />
            <CategoryTag category={meme.category} className="shadow-sm" />
          </div>
          {sourcePlatform && <SourcePlatformBadge platform={sourcePlatform} />}
        </div>

        {rank != null && (
          <span
            aria-hidden
            className={`stat-mono pointer-events-none absolute bottom-2 left-2.5 text-[2.35rem] font-black italic leading-none tracking-tighter ${
              rank <= 3 ? "text-accent" : "text-white"
            }`}
            style={{ filter: "drop-shadow(0 1px 3px rgb(0 0 0 / 0.62))" }}
          >
            {rank}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3.5">
        {rank != null && <span className="sr-only">{rank}위</span>}
        {/* line-clamp로 잘린 긴 제목의 전체 텍스트 접근 경로(title 툴팁) — LOOP.md §6 */}
        <p
          title={meme.title}
          className="line-clamp-2 min-h-[2.75em] break-keep text-lg font-extrabold leading-snug"
        >
          {meme.title}
        </p>
        <p className="line-clamp-2 min-h-[3.25em] break-keep text-sm leading-relaxed text-muted">
          {meme.summary}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-border pt-2.5">
          <SafetyBadge level={meme.safety_level} />
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
