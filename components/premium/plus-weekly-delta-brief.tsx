import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { toBcp47 } from "@/lib/i18n";
import { memePathFrom } from "@/lib/labels";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import {
  localizedMemePath,
  type SeoRouteLocale,
} from "@/lib/i18n-routing";
import { resolvePlusContentLocale } from "@/lib/plus-localized-feed";
import type { PlusWeeklyDeltaBrief } from "@/lib/plus-weekly-brief";

export function PlusWeeklyDeltaBrief({
  brief,
  locale,
  contentLocale,
}: {
  brief: PlusWeeklyDeltaBrief;
  locale: Locale;
  contentLocale?: SeoRouteLocale;
}) {
  const copy = PREMIUM_COPY[locale].dashboard.weeklyBrief;
  const resolvedContentLocale = contentLocale ?? resolvePlusContentLocale(locale);
  const dateFormatter = new Intl.DateTimeFormat(toBcp47(locale), {
    month: "short",
    day: "numeric",
  });
  const from = dateFormatter.format(new Date(`${brief.window.from}T12:00:00Z`));
  const to = dateFormatter.format(new Date(`${brief.window.to}T12:00:00Z`));
  const numberFormatter = new Intl.NumberFormat(toBcp47(locale), {
    maximumFractionDigits: 0,
  });

  if (brief.items.length === 0) {
    return (
      <section
        aria-labelledby="plus-weekly-brief-title"
        data-plus-weekly-brief="empty"
        className="mt-6 rounded-2xl border border-border bg-surface p-5"
      >
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          {copy.eyebrow}
        </p>
        <h2 id="plus-weekly-brief-title" className="mt-1 text-lg font-bold">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {brief.emptyReason === "unavailable"
            ? copy.unavailable
            : brief.emptyReason === "coverage_empty"
              ? copy.coverageEmpty
            : brief.emptyReason === "no_candidates"
                ? copy.emptyNoCandidates
                : brief.emptyReason === "no_change"
                  ? copy.emptyNoChange
                : copy.emptyInsufficientHistory}
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="plus-weekly-brief-title"
      data-plus-weekly-brief="active"
      className="mt-6 rounded-2xl border border-border bg-surface p-5"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
        {copy.eyebrow}
      </p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="plus-weekly-brief-title" className="text-lg font-bold">
          {copy.title}
        </h2>
        <span className="text-xs font-semibold text-muted">{copy.window(from, to)}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {copy.summary(brief.scannedCount)}
      </p>
      <ol className="mt-4 grid gap-3">
        {brief.items.map((item, index) => {
          const href = resolvedContentLocale !== "ko"
            ? localizedMemePath(resolvedContentLocale, item.shortId, item.slug)
            : memePathFrom(item.shortId, item.slug);
          return (
            <li key={item.memeId}>
              <Link
                href={`${href}#trend-panel-title`}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-4 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-strong text-sm font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {item.source === "saved" ? copy.sourceSaved : copy.sourceInterest}
                  </span>
                </span>
                <span className="shrink-0 self-center text-right text-xs font-bold text-accent-text">
                  <span className="block">+{numberFormatter.format(item.delta)}</span>
                  <span className="mt-1 block font-medium text-muted">{copy.openTrend}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
