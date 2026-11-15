import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { memePathFrom } from "@/lib/labels";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import {
  isSeoContentLocale,
  localizedMemePath,
} from "@/lib/i18n-routing";
import {
  buildPlusActionQueue,
} from "@/lib/plus-action-queue";
import type { SavedReuseRadarItem } from "@/lib/saved-reuse-radar";

export function PlusActionQueue({
  items,
  savedCount,
  locale,
}: {
  items: readonly SavedReuseRadarItem[];
  savedCount: number;
  locale: Locale;
}) {
  const copy = PREMIUM_COPY[locale].dashboard.actionQueue;
  const actions = buildPlusActionQueue(items);

  if (actions.length === 0) {
    return (
      <section
        aria-labelledby="plus-action-queue-title"
        data-plus-action-queue="empty"
        className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft/20 p-5"
      >
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          {copy.eyebrow}
        </p>
        <h2 id="plus-action-queue-title" className="mt-1 text-lg font-bold">
          {copy.emptyTitle}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.emptyBody}</p>
        <Link
          href="/explore"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98]"
        >
          {copy.explore}
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="plus-action-queue-title"
      data-plus-action-queue="active"
      className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft/20 p-5"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
        {copy.eyebrow}
      </p>
      <h2 id="plus-action-queue-title" className="mt-1 text-lg font-bold">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {copy.summary(savedCount)}
      </p>
      <ol className="mt-4 grid gap-3">
        {actions.map(({ kind, item }, index) => {
          const actionCopy = copy[kind];
          const href = isSeoContentLocale(locale)
            ? localizedMemePath(locale, item.shortId, item.slug)
            : memePathFrom(item.shortId, item.slug);
          return (
            <li key={`${kind}-${item.id}`}>
              <Link
                href={`${href}#meme-use-kit-title`}
                className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-strong text-sm font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{item.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {actionCopy.description}
                  </span>
                </span>
                <span className="shrink-0 self-center text-xs font-bold text-accent-text">
                  {actionCopy.cta}
                  <span aria-hidden> →</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
