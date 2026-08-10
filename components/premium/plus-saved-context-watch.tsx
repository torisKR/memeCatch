"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { memePathFrom } from "@/lib/labels";
import { isSeoContentLocale, localizedMemePath } from "@/lib/i18n-routing";
import type {
  SavedContextWatchItem,
  SavedContextWatchKind,
} from "@/lib/saved-context-watch";

export function savedContextWatchKindLabel(
  kind: SavedContextWatchKind,
  copy: ReturnType<typeof getContextWatchCopy>,
): string {
  return copy.kinds[kind];
}

function getContextWatchCopy(locale: Locale) {
  return PREMIUM_COPY[locale].dashboard.contextWatch;
}

function watchHref(locale: Locale, item: SavedContextWatchItem): string {
  const path = isSeoContentLocale(locale)
    ? localizedMemePath(locale, item.shortId, item.slug)
    : memePathFrom(item.shortId, item.slug);
  return `${path}#meme-use-kit-title`;
}

export function PlusSavedContextWatch({
  items,
  locale,
  savedCount,
}: {
  items: readonly SavedContextWatchItem[];
  locale: Locale;
  savedCount: number;
}) {
  const copy = getContextWatchCopy(locale);
  const [alerts, setAlerts] = useState([...items]);
  const [marking, setMarking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const unreadCount = alerts.filter((item) => item.readAt === null).length;

  async function markRead() {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    setStatus(null);
    try {
      const response = await fetch("/api/saved-context-alerts", { method: "POST" });
      if (!response.ok) throw new Error("mark_failed");
      const now = new Date().toISOString();
      setAlerts((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setStatus(copy.markedRead);
    } catch {
      setStatus(copy.markFailed);
    } finally {
      setMarking(false);
    }
  }

  return (
    <section
      aria-labelledby="plus-context-watch-title"
      data-plus-context-watch={alerts.length > 0 ? "active" : "empty"}
      className="mt-6 rounded-2xl border border-accent/30 bg-accent-soft/20 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
            {copy.eyebrow}
          </p>
          <h2 id="plus-context-watch-title" className="mt-1 text-lg font-bold">
            {copy.title}
          </h2>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markRead}
            disabled={marking}
            className="min-h-10 rounded-xl border border-accent/40 bg-surface px-3 text-xs font-bold text-accent-text transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
          >
            {marking ? copy.marking : copy.markRead}
          </button>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {alerts.length > 0 ? copy.summary(alerts.length, unreadCount) : copy.emptyBody(savedCount)}
      </p>
      {status && (
        <p className="mt-2 text-xs font-semibold text-accent-text" role="status">
          {status}
        </p>
      )}
      {alerts.length > 0 && (
        <ol className="mt-4 grid gap-3">
          {alerts.map((item) => (
            <li key={`${item.id}-${item.kind}`} data-context-watch-kind={item.kind}>
              <Link
                href={watchHref(locale, item)}
                className={`flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${item.readAt === null ? "border-l-4 border-l-accent" : ""}`}
              >
                <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-strong" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-accent-text">
                    {savedContextWatchKindLabel(item.kind, copy)}
                    {item.readAt === null && (
                      <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px]">
                        {copy.unread}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm font-bold">{item.title}</span>
                </span>
                <span className="shrink-0 self-center text-xs font-bold text-accent-text">
                  {copy.open}
                  <span aria-hidden> →</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
