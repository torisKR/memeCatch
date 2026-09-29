import Link from "next/link";
import { MemeThumbnail } from "@/components/meme-thumbnail";
import { CountryFlagBadge } from "@/components/country-flag-badge";
import { getSeoCopy, localizedMemePath, type SeoContentLocale } from "@/lib/i18n-routing";
import type { LocalizedMemeListItem } from "@/lib/meme-translations";
import type { LocalizedExploreCopy } from "@/lib/i18n-global-explore";
import { originCountryCode } from "@/lib/meme-country";

export function LocalizedExploreCard({
  locale,
  meme,
  copy,
  priority = false,
}: {
  locale: SeoContentLocale;
  meme: LocalizedMemeListItem;
  copy: LocalizedExploreCopy;
  priority?: boolean;
}) {
  const thumbnail =
    meme.meme_contents.find((content) => content.is_representative && content.thumbnail_url)
      ?.thumbnail_url ??
    meme.meme_contents.find((content) => content.thumbnail_url)?.thumbnail_url ??
    null;
  const safety = meme.safety_level as keyof typeof copy.safety;
  const countryCode = originCountryCode(meme.meme_market_profiles);

  return (
    <li className="min-w-0">
      <Link
        href={localizedMemePath(locale, meme.short_id, meme.slug)}
        className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-surface-2">
          <MemeThumbnail
            src={thumbnail}
            title={meme.title}
            fallbackCaption={meme.summary}
            category={meme.category}
            originYear={meme.origin_year}
            priority={priority}
          />
          <div
            data-country-flag-position="top-right"
            className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2"
          >
            <span className="rounded-full border border-white/30 bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              {getSeoCopy(locale).categories[meme.category]}
            </span>
            <CountryFlagBadge code={countryCode} locale={locale} />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col p-4">
          <p className="line-clamp-2 min-h-[3.25rem] text-xl font-black leading-snug tracking-tight">
            {meme.title}
          </p>
          <p className="mt-2 line-clamp-3 min-h-[4.5rem] text-sm leading-relaxed text-muted">
            {meme.summary}
          </p>
          <div className="mt-auto border-t border-border pt-3 text-xs text-muted">
            <p className="truncate" title={meme.original.title}>
              <span className="font-semibold text-foreground">{copy.originalLabel}:</span>{" "}
              {meme.original.title}
            </p>
            <p className="mt-1 truncate" title={copy.safety[safety]}>
              <span className="font-semibold text-foreground">{copy.safetyLabel}:</span>{" "}
              {copy.safety[safety]}
            </p>
            <span className="mt-3 inline-flex text-sm font-bold text-foreground group-hover:text-accent">
              {copy.read} <span aria-hidden className="ml-1">→</span>
            </span>
          </div>
        </div>
      </Link>
    </li>
  );
}
