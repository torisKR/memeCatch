"use client";

import { useState } from "react";
import type {
  PlusOutcomeFollowUpItem,
  PlusOutcomeRating,
} from "@/lib/plus-outcome-ledger";
import type { PlusOutcomeLedgerCopy } from "@/lib/plus-outcome-copy";

export function PlusOutcomeFollowUp({
  items,
  copy,
  onSaved,
  onRated,
}: {
  items: readonly PlusOutcomeFollowUpItem[];
  copy: PlusOutcomeLedgerCopy;
  onSaved: (receiptId: string) => void;
  onRated?: (
    item: Pick<PlusOutcomeFollowUpItem, "receiptId" | "memeId" | "completionDate" | "channel">,
    rating: PlusOutcomeRating,
  ) => void;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const summaryCopy = copy.summary.followUp;

  function startEditing(item: PlusOutcomeFollowUpItem): void {
    setEditingId(item.receiptId);
    setDraft(item.performanceNote ?? "");
    setError(null);
    setStatus(null);
  }

  function cancelEditing(): void {
    setEditingId(null);
    setDraft("");
    setError(null);
  }

  async function savePerformance(item: PlusOutcomeFollowUpItem): Promise<void> {
    const performanceNote = draft.trim();
    if (!performanceNote) {
      setError(summaryCopy.required);
      return;
    }

    setBusyId(item.receiptId);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/plus/outcome-ledger/performance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ receiptId: item.receiptId, performanceNote }),
      });
      const payload = (await response.json().catch(() => null)) as {
        updated?: unknown;
        receiptId?: unknown;
        performanceNote?: unknown;
      } | null;
      if (
        !response.ok ||
        payload?.updated !== true ||
        payload.receiptId !== item.receiptId ||
        payload.performanceNote !== performanceNote
      ) {
        setError(summaryCopy.failed);
        return;
      }

      setLocalItems((current) =>
        current.map((candidate) =>
          candidate.receiptId === item.receiptId
            ? { ...candidate, performanceNote }
            : candidate,
        ),
      );
      setEditingId(null);
      setDraft("");
      setStatus(summaryCopy.saved);
      onSaved(item.receiptId);
    } catch {
      setError(summaryCopy.failed);
    } finally {
      setBusyId(null);
    }
  }

  async function saveRating(item: PlusOutcomeFollowUpItem, rating: PlusOutcomeRating): Promise<void> {
    if (item.performanceRating) return;

    setBusyId(item.receiptId);
    setError(null);
    setStatus(null);
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
        setError(summaryCopy.ratingFailed);
        return;
      }

      setLocalItems((current) =>
        current.map((candidate) =>
          candidate.receiptId === item.receiptId
            ? { ...candidate, performanceRating: rating }
            : candidate,
        ),
      );
      setStatus(summaryCopy.ratingSaved);
      onRated?.(
        {
          receiptId: item.receiptId,
          memeId: item.memeId,
          completionDate: item.completionDate,
          channel: item.channel,
        },
        rating,
      );
    } catch {
      setError(summaryCopy.ratingFailed);
    } finally {
      setBusyId(null);
    }
  }

  if (localItems.length === 0) return null;

  return (
    <section
      data-plus-outcome-follow-up="ready"
      aria-labelledby="plus-outcome-follow-up-title"
      className="mt-5 border-t border-border pt-4"
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-accent-text">
        {summaryCopy.recent}
      </p>
      <h3 id="plus-outcome-follow-up-title" className="mt-1 text-sm font-black text-accent-text">
        {summaryCopy.title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-muted">{summaryCopy.description}</p>

      <ol className="mt-3 grid gap-3">
        {localItems.map((item) => {
          const isEditing = editingId === item.receiptId;
          const isBusy = busyId === item.receiptId;
          return (
            <li
              key={item.receiptId}
              data-plus-outcome-follow-up-item={item.performanceNote ? "complete" : "pending"}
              className="rounded-xl border border-border bg-surface-2 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    <time dateTime={item.completionDate}>{item.completionDate}</time>
                    <span aria-hidden> · </span>
                    {copy.receipt.channelOptions[item.channel]}
                    <span aria-hidden> · </span>
                    {copy.summary.localeNames[item.locale]}
                    <span aria-hidden> · </span>
                    {copy.receipt.artifactOptions[item.artifactKind]}
                  </p>
                </div>
                {!item.performanceNote && !isEditing && (
                  <button
                    type="button"
                    onClick={() => startEditing(item)}
                    className="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-accent/40 px-3 text-xs font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {summaryCopy.add}
                  </button>
                )}
              </div>

              {item.performanceNote && !isEditing && (
                <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-sm leading-relaxed text-foreground">
                  <span className="font-bold text-accent-text">{summaryCopy.performance}: </span>
                  {item.performanceNote}
                </p>
              )}

              <div className="mt-3">
                <p className="text-xs font-bold text-foreground">{summaryCopy.rating}</p>
                {item.performanceRating ? (
                  <p className="mt-1 text-xs font-semibold text-accent-text" role="status">
                    {summaryCopy.ratingOptions[item.performanceRating]}
                  </p>
                ) : (
                  <div
                    className="mt-2 flex flex-wrap gap-2"
                    role="group"
                    aria-label={`${summaryCopy.rating}: ${item.title}`}
                  >
                    {(Object.keys(summaryCopy.ratingOptions) as PlusOutcomeRating[]).map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => void saveRating(item, rating)}
                        disabled={isBusy}
                        className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 text-xs font-bold text-accent-text disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {isBusy ? summaryCopy.ratingSaving : summaryCopy.ratingOptions[rating]}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isEditing && (
                <form
                  className="mt-3"
                  aria-label={`${summaryCopy.performance}: ${item.title}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void savePerformance(item);
                  }}
                >
                  <label
                    htmlFor={`plus-outcome-follow-up-${item.receiptId}`}
                    className="text-xs font-bold text-foreground"
                  >
                    {summaryCopy.performance}
                  </label>
                  <textarea
                    id={`plus-outcome-follow-up-${item.receiptId}`}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={isBusy}
                    maxLength={1000}
                    rows={3}
                    autoFocus
                    placeholder={summaryCopy.placeholder}
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-3 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      {isBusy ? summaryCopy.saving : summaryCopy.save}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      disabled={isBusy}
                      className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs font-bold text-accent-text disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {summaryCopy.cancel}
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ol>
      {error && (
        <p className="mt-3 text-sm font-semibold text-safety-red" role="alert">
          {error}
        </p>
      )}
      {status && (
        <p className="mt-3 text-xs font-semibold text-accent-text" role="status">
          {status}
        </p>
      )}
    </section>
  );
}
