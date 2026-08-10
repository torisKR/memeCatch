import {
  BadgeCheck,
  BookOpenText,
  Clock3,
  Flame,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { LANGUAGE_NAMES, toBcp47, type Locale } from "@/lib/i18n";
import {
  LIFECYCLE_STATUS,
  SAFETY_LEVELS,
  memePathFrom,
  type LifecycleStatus,
  type SafetyLevel,
} from "@/lib/labels";
import {
  localizedMemePath,
} from "@/lib/i18n-routing";
import type {
  PlusGlobalScoutItem,
  PlusGlobalScoutLocale,
  PlusGlobalScoutStatus,
} from "@/lib/plus-global-scout";
import { PLUS_GLOBAL_SCOUT_COPY } from "@/lib/plus-global-scout-copy";

export type { PlusGlobalScoutItem } from "@/lib/plus-global-scout";

export type PlusGlobalScoutProps = {
  locale: PlusGlobalScoutLocale;
  displayLocale?: Locale;
  items: readonly PlusGlobalScoutItem[];
  status?: PlusGlobalScoutStatus;
  dateKey?: string;
  dateLabel?: string;
};

const SAFETY_CLASS: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

const LIFECYCLE_CLASS: Record<LifecycleStatus, string> = {
  rising: "text-(--life-rising)",
  active: "text-(--life-active)",
  cooling: "text-(--life-cooling)",
  archived: "text-(--life-archived)",
};

export function PlusGlobalScout({
  locale,
  displayLocale,
  items,
  status,
  dateKey,
  dateLabel,
}: PlusGlobalScoutProps) {
  const copy = PLUS_GLOBAL_SCOUT_COPY[locale];
  const resolvedDisplayLocale = displayLocale ?? locale;
  const visibleItems = items.slice(0, 5);
  const deckContext = dateLabel?.trim() || formatDeckDate(dateKey, resolvedDisplayLocale) || copy.dailyLabel;
  const state: PlusGlobalScoutStatus = status ?? (visibleItems.length > 0 ? "active" : "empty");

  return (
    <section
      aria-labelledby="plus-global-scout-title"
      lang={toBcp47(locale)}
      data-plus-global-scout={state}
      data-deck-count={visibleItems.length}
      data-deck-date={dateKey || undefined}
      data-deck-content-locale={visibleItems[0]?.locale || undefined}
      data-deck-display-locale={resolvedDisplayLocale}
      className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
            {copy.eyebrow}
          </p>
          <h2 id="plus-global-scout-title" className="mt-1 text-xl font-bold tracking-tight">
            {copy.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{copy.intro}</p>
        </div>
        {dateKey ? (
          <time
            dateTime={dateKey}
            lang={toBcp47(resolvedDisplayLocale)}
            className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted"
          >
            {copy.dateLabel}: {deckContext}
          </time>
        ) : (
          <span className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted">
            {deckContext}
          </span>
        )}
      </div>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label={`${copy.reviewedLabel}, ${copy.currentLabel}`}
      >
        <ProofBadge icon={<BadgeCheck aria-hidden className="size-4" />} label={copy.reviewedLabel} />
        <ProofBadge icon={<Clock3 aria-hidden className="size-4" />} label={copy.currentLabel} />
      </div>

      {state === "unavailable" ? (
        <div className="mt-5 rounded-xl bg-surface-2 p-4" role="status">
          <h3 className="text-base font-bold">{copy.unavailableTitle}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.unavailableBody}</p>
        </div>
      ) : state === "empty" ? (
        <div className="mt-5 rounded-xl bg-surface-2 p-4" role="status">
          <h3 className="text-base font-bold">{copy.emptyTitle}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{copy.emptyBody}</p>
        </div>
      ) : (
        <ol className="mt-5 grid gap-3 lg:grid-cols-2">
          {visibleItems.map((item) => {
            const href = item.locale === "ko"
              ? memePathFrom(item.shortId, item.slug)
              : localizedMemePath(item.locale, item.shortId, item.slug);

            return (
              <li
                key={item.id}
                data-scout-card={item.id}
                data-safety={item.safetyLevel}
                data-lifecycle={item.lifecycleStatus}
                className="min-w-0"
              >
                <Link
                  href={href}
                  aria-label={`${item.title} — ${copy.openMeme}`}
                  className="group flex h-full flex-col rounded-xl border border-border bg-surface-2 p-4 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <SignalBadge
                      className={SAFETY_CLASS[item.safetyLevel]}
                      icon={<ShieldCheck aria-hidden className="size-3.5" />}
                      label={`${copy.safetyLabel}: ${copy.safety[item.safetyLevel]}`}
                      symbol={SAFETY_LEVELS[item.safetyLevel].icon}
                    />
                    <SignalBadge
                      className={LIFECYCLE_CLASS[item.lifecycleStatus]}
                      icon={<Flame aria-hidden className="size-3.5" />}
                      label={`${copy.lifecycleLabel}: ${copy.lifecycle[item.lifecycleStatus]}`}
                      symbol={`${LIFECYCLE_STATUS[item.lifecycleStatus].flame}/4`}
                    />
                  </span>

                  {item.locale !== resolvedDisplayLocale && (
                    <span className="mt-3 inline-flex w-fit rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-muted">
                      {copy.contentLanguageLabel}: {LANGUAGE_NAMES[item.locale]}
                    </span>
                  )}

                  <div lang={toBcp47(item.locale)}>
                    <span className="mt-3 block text-base font-bold leading-snug group-hover:text-accent-text">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{item.summary}</span>

                    {(item.usageNote || item.caution) && (
                      <dl className="mt-3 grid gap-2 border-t border-border pt-3 text-xs leading-relaxed">
                        {item.usageNote && (
                          <div className="grid grid-cols-[auto_1fr] gap-2">
                            <dt className="flex items-start gap-1 font-semibold text-foreground">
                              <BookOpenText aria-hidden className="mt-0.5 size-3.5" />
                              {copy.usageLabel}
                            </dt>
                            <dd className="text-muted">{item.usageNote}</dd>
                          </div>
                        )}
                        {item.caution && (
                          <div className="grid grid-cols-[auto_1fr] gap-2 rounded-lg bg-safety-yellow-bg px-2.5 py-2">
                            <dt className="flex items-start gap-1 font-semibold text-safety-yellow">
                              <TriangleAlert aria-hidden className="mt-0.5 size-3.5" />
                              {copy.cautionLabel}
                            </dt>
                            <dd className="text-safety-yellow">{item.caution}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </div>

                  <span className="mt-auto pt-4 text-xs font-bold text-accent-text">
                    {copy.openMeme}
                    <span aria-hidden> →</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function formatDeckDate(dateKey: string | undefined, locale: Locale): string | null {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(toBcp47(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function ProofBadge({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-safety-green-bg px-2.5 py-1 text-xs font-semibold text-safety-green">
      {icon}
      {label}
    </span>
  );
}

function SignalBadge({
  className,
  icon,
  label,
  symbol,
}: {
  className: string;
  icon: ReactNode;
  label: string;
  symbol: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>
      {icon}
      <span aria-hidden>{symbol}</span>
      {label}
    </span>
  );
}
