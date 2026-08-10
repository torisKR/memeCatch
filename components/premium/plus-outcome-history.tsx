"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import { PLUS_OUTCOME_COPY } from "@/lib/plus-outcome-copy";
import {
  isPlusOutcomeChannel,
  isPlusOutcomeRating,
  PLUS_OUTCOME_CHANNELS,
  PLUS_OUTCOME_RATINGS,
  type PlusOutcomeChannel,
  type PlusOutcomeHistory,
  type PlusOutcomeLocale,
  type PlusOutcomeRating,
} from "@/lib/plus-outcome-ledger";
import { PLUS_OUTCOME_HISTORY_COPY } from "@/lib/plus-outcome-history-copy";
import { buildPlusOutcomeReplayPath } from "@/lib/plus-outcome-replay-routing";

type ChannelFilter = "all" | PlusOutcomeChannel;
type RatingFilter = "all" | PlusOutcomeRating;

export function PlusOutcomeHistory({
  history,
  locale,
  activeReplay = null,
}: {
  history: PlusOutcomeHistory;
  locale: Locale;
  activeReplay?: { shortId: string; locale: PlusOutcomeLocale } | null;
}) {
  const copy = PLUS_OUTCOME_HISTORY_COPY[locale];
  const outcomeCopy = PLUS_OUTCOME_COPY[locale];
  const router = useRouter();
  const [localRatings, setLocalRatings] = useState<Record<string, PlusOutcomeRating>>({});
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [expandedRatingId, setExpandedRatingId] = useState<string | null>(null);
  const [busyRatingId, setBusyRatingId] = useState<string | null>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingStatus, setRatingStatus] = useState<string | null>(null);

  const localItems = useMemo(
    () =>
      history.items.map((item) => {
        const localRating = localRatings[item.receiptId];
        return localRating && !item.performanceRating
          ? { ...item, performanceRating: localRating }
          : item;
      }),
    [history.items, localRatings],
  );

  const filteredItems = useMemo(
    () =>
      localItems.filter(
        (item) =>
          (channelFilter === "all" || item.channel === channelFilter) &&
          (ratingFilter === "all" || item.performanceRating === ratingFilter),
      ),
    [channelFilter, localItems, ratingFilter],
  );

  async function saveRating(
    item: (typeof localItems)[number],
    rating: PlusOutcomeRating,
  ): Promise<void> {
    if (item.performanceRating || busyRatingId) return;

    setBusyRatingId(item.receiptId);
    setRatingError(null);
    setRatingStatus(null);
    try {
      const response = await fetch("/api/plus/outcome-ledger/rating", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receiptId: item.receiptId, performanceRating: rating }),
      });
      const payload = (await response.json().catch(() => null)) as {
        updated?: unknown;
        receiptId?: unknown;
        performanceRating?: unknown;
      } | null;
      if (
        !response.ok ||
        payload?.updated !== true ||
        payload.receiptId !== item.receiptId ||
        payload.performanceRating !== rating
      ) {
        setRatingError(outcomeCopy.summary.followUp.ratingFailed);
        return;
      }

      setLocalRatings((current) => ({ ...current, [item.receiptId]: rating }));
      setExpandedRatingId(null);
      setRatingStatus(outcomeCopy.summary.followUp.ratingSaved);
      router.refresh();
    } catch {
      setRatingError(outcomeCopy.summary.followUp.ratingFailed);
    } finally {
      setBusyRatingId(null);
    }
  }

  if (history.status !== "ready") {
    const message =
      history.status === "empty"
        ? copy.empty
        : history.status === "unavailable"
          ? copy.unavailable
          : copy.locked;
    return (
      <section
        data-plus-outcome-history={history.status}
        className="mb-6 rounded-2xl border border-border bg-surface p-5"
        aria-labelledby="plus-outcome-history-title"
      >
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
          {copy.eyebrow}
        </p>
        <h2 id="plus-outcome-history-title" className="mt-1 text-lg font-black tracking-tight">
          {copy.title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted" role={history.status === "unavailable" ? "status" : undefined}>
          {message}
        </p>
      </section>
    );
  }

  return (
    <section
      data-plus-outcome-history="ready"
      className="mb-6 rounded-2xl border border-border bg-surface p-5"
      aria-labelledby="plus-outcome-history-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
            {copy.eyebrow}
          </p>
          <h2 id="plus-outcome-history-title" className="mt-1 text-lg font-black tracking-tight">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{copy.description}</p>
        </div>
        <p className="text-xs font-bold text-accent-text">{copy.showing(filteredItems.length)}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-bold text-muted">
          <span>{copy.channelFilter}</span>
          <select
            aria-label={copy.channelFilter}
            value={channelFilter}
            onChange={(event) => {
              const value = event.target.value;
              setChannelFilter(
                value === "all" ? "all" : isPlusOutcomeChannel(value) ? value : "all",
              );
            }}
            className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-foreground"
          >
            <option value="all">{copy.all}</option>
            {PLUS_OUTCOME_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {outcomeCopy.receipt.channelOptions[channel]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold text-muted">
          <span>{copy.ratingFilter}</span>
          <select
            aria-label={copy.ratingFilter}
            value={ratingFilter}
            onChange={(event) => {
              const value = event.target.value;
              setRatingFilter(
                value === "all" ? "all" : isPlusOutcomeRating(value) ? value : "all",
              );
            }}
            className="min-h-10 rounded-lg border border-border bg-surface px-3 text-sm font-semibold text-foreground"
          >
            <option value="all">{copy.all}</option>
            {PLUS_OUTCOME_RATINGS.map((rating) => (
              <option key={rating} value={rating}>
                {outcomeCopy.summary.followUp.ratingOptions[rating]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredItems.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
          {copy.filteredEmpty}
        </p>
      ) : (
        <ol className="mt-4 grid gap-3">
          {filteredItems.map((item, index) => (
            <li
              key={`${item.completionDate}-${index}`}
              data-plus-outcome-history-item={item.performanceRating ?? "unrated"}
              className="rounded-xl border border-border bg-surface-2 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="min-w-0 text-sm font-bold text-foreground underline decoration-accent/60 underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <span className="min-w-0 text-sm font-bold text-foreground">{item.title}</span>
                )}
                <span className="shrink-0 text-xs font-bold text-accent-text">
                  {item.performanceRating
                    ? outcomeCopy.summary.followUp.ratingOptions[item.performanceRating]
                    : copy.noRating}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                <time dateTime={item.completionDate}>{item.completionDate}</time>
                <span aria-hidden> · </span>
                {outcomeCopy.receipt.channelOptions[item.channel]}
                <span aria-hidden> · </span>
                {outcomeCopy.summary.localeNames[item.locale]}
                <span aria-hidden> · </span>
                {outcomeCopy.receipt.artifactOptions[item.artifactKind]}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {item.hasPerformanceNote
                  ? copy.performanceNote
                  : copy.noPerformanceNote}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-accent-text">
                <span data-plus-outcome-history-link-status={item.linkStatus}>
                  {item.linkStatus === "localized"
                    ? copy.localizedLink
                    : item.linkStatus === "korean-fallback"
                      ? copy.koreanFallbackLink
                      : copy.unavailableLink}
                </span>
                {item.href ? (
                  <Link
                    href={item.href}
                    className="inline-flex min-h-8 items-center underline underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {copy.open} →
                  </Link>
                ) : (
                  <span role="status">{copy.unavailableLink}</span>
                )}
                {item.resultUrl ? (
                  <a
                    href={item.resultUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    data-plus-outcome-history-result
                    className="inline-flex min-h-8 items-center underline underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {copy.resultLink} ↗
                  </a>
                ) : (
                  <span data-plus-outcome-history-result="missing" role="status">
                    {copy.resultMissing}
                  </span>
                )}
                {item.performanceRating === "hit" &&
                item.replayShortId &&
                (item.linkStatus === "localized" ||
                  (item.linkStatus === "korean-fallback" && item.locale === "ko")) &&
                buildPlusOutcomeReplayPath(item.replayShortId, item.locale) ? (
                  activeReplay?.shortId === item.replayShortId &&
                  activeReplay.locale === item.locale ? (
                    <span
                      data-plus-outcome-history-replay="active"
                      role="status"
                      className="inline-flex min-h-8 items-center rounded-md bg-accent-soft px-2"
                    >
                      {copy.replayActive}
                    </span>
                  ) : (
                    <Link
                      href={buildPlusOutcomeReplayPath(item.replayShortId, item.locale) ?? "#"}
                      data-plus-outcome-history-replay
                      className="inline-flex min-h-8 items-center rounded-md bg-accent-soft px-2 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {copy.replay} ↻
                    </Link>
                  )
                ) : null}
              </div>

              {item.performanceRating === null ? (
                <div className="mt-3 border-t border-border pt-3">
                  <button
                    type="button"
                    aria-expanded={expandedRatingId === item.receiptId}
                    data-plus-outcome-history-rate-trigger
                    onClick={() => {
                      setRatingError(null);
                      setRatingStatus(null);
                      setExpandedRatingId((current) =>
                        current === item.receiptId ? null : item.receiptId,
                      );
                    }}
                    className="inline-flex min-h-10 items-center rounded-lg border border-accent/40 px-3 text-xs font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {copy.rate}
                  </button>
                  {expandedRatingId === item.receiptId ? (
                    <div
                      className="mt-3 rounded-lg bg-surface px-3 py-3"
                      data-plus-outcome-history-rating
                      role="group"
                      aria-label={`${outcomeCopy.summary.followUp.rating}: ${item.title}`}
                    >
                      <p className="text-xs font-bold text-foreground">
                        {outcomeCopy.summary.followUp.rating}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(
                          Object.keys(
                            outcomeCopy.summary.followUp.ratingOptions,
                          ) as PlusOutcomeRating[]
                        ).map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            onClick={() => void saveRating(item, rating)}
                            disabled={busyRatingId !== null}
                            className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-bold text-accent-text disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            {busyRatingId === item.receiptId
                              ? outcomeCopy.summary.followUp.ratingSaving
                              : outcomeCopy.summary.followUp.ratingOptions[rating]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
      {ratingStatus ? (
        <p className="mt-3 text-sm font-semibold text-accent-text" role="status">
          {ratingStatus}
        </p>
      ) : null}
      {ratingError ? (
        <p className="mt-3 text-sm font-semibold text-safety-red" role="alert">
          {ratingError}
        </p>
      ) : null}
    </section>
  );
}
