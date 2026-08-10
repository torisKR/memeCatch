"use client";

import { useState } from "react";
import type { PlusGlobalActionInboxItem } from "@/lib/plus-global-action-inbox";
import type {
  PlusOutcomeArtifactKind,
  PlusOutcomeChannel,
  PlusOutcomeLedgerCopy,
} from "@/lib/plus-outcome-copy";

export type PlusOutcomeReceiptResponse = {
  receiptId: string;
  alreadyRecorded: boolean;
  completedTodayCount: number;
  currentStreak: number;
  channel: PlusOutcomeChannel;
  locale: string;
  artifactKind: PlusOutcomeArtifactKind;
  performanceNote: string | null;
};

export function PlusOutcomeReceiptForm({
  item,
  copy,
  defaultChannel,
  defaultArtifactKind = "caption",
  compact = false,
  onCancel,
  onSaved,
}: {
  item: Pick<PlusGlobalActionInboxItem, "memeId" | "locale" | "title">;
  copy: PlusOutcomeLedgerCopy["receipt"];
  defaultChannel?: PlusOutcomeChannel;
  defaultArtifactKind?: PlusOutcomeArtifactKind;
  compact?: boolean;
  onCancel: () => void;
  onSaved: (receipt: PlusOutcomeReceiptResponse) => void;
}) {
  const [channel, setChannel] = useState<PlusOutcomeChannel | "">(defaultChannel ?? "");
  const [artifactKind, setArtifactKind] = useState<PlusOutcomeArtifactKind>(defaultArtifactKind);
  const [resultUrl, setResultUrl] = useState("");
  const [performanceNote, setPerformanceNote] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    if (!channel) {
      setState("error");
      setError(copy.required);
      return;
    }
    if (compact && !resultUrl.trim()) {
      setState("error");
      setError(copy.resultRequired);
      return;
    }

    setState("busy");
    setError(null);
    try {
      const response = await fetch("/api/plus/action-inbox/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          memeId: item.memeId,
          locale: item.locale,
          channel,
          artifactKind,
          mode: compact ? "one_cut" : "bulk",
          resultUrl: resultUrl.trim() || null,
          performanceNote: compact ? null : performanceNote.trim() || null,
          privateNote: compact ? null : privateNote.trim() || null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        receiptId?: unknown;
        alreadyRecorded?: unknown;
        completedTodayCount?: unknown;
        currentStreak?: unknown;
        error?: unknown;
      } | null;
      if (
        !response.ok ||
        typeof payload?.receiptId !== "string" ||
        typeof payload.completedTodayCount !== "number" ||
        typeof payload.currentStreak !== "number"
      ) {
        setState("error");
        setError(
          response.status === 409
            ? copy.conflict
            : response.status === 400 || response.status === 422
              ? copy.invalid
              : copy.failed,
        );
        return;
      }

      onSaved({
        receiptId: payload.receiptId,
        alreadyRecorded: payload.alreadyRecorded === true,
        completedTodayCount: payload.completedTodayCount,
        currentStreak: payload.currentStreak,
        channel,
        locale: item.locale,
        artifactKind,
        performanceNote: compact ? null : performanceNote.trim() || null,
      });
    } catch {
      setState("error");
      setError(copy.failed);
    }
  }

  return (
    <form
      className="mt-3 rounded-xl border border-accent/40 bg-surface p-4"
      data-plus-outcome-receipt-mode={compact ? "compact" : "full"}
      aria-labelledby={`plus-outcome-receipt-${item.memeId}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h4 id={`plus-outcome-receipt-${item.memeId}`} className="text-sm font-black text-accent-text">
        {copy.title}
      </h4>
      <p className="mt-2 text-sm font-bold text-foreground">{item.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{copy.body}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`plus-outcome-locale-${item.memeId}`} className="text-xs font-bold text-foreground">
            {copy.locale}
          </label>
          <output
            id={`plus-outcome-locale-${item.memeId}`}
            className="mt-1 flex min-h-11 items-center rounded-lg border border-border bg-surface-2 px-3 text-base"
          >
            <span className="font-mono text-xs font-black uppercase">{item.locale}</span>
          </output>
        </div>

        <div>
          <label htmlFor={`plus-outcome-channel-${item.memeId}`} className="text-xs font-bold text-foreground">
            {copy.channel}
          </label>
          <select
            id={`plus-outcome-channel-${item.memeId}`}
            value={channel}
            onChange={(event) => setChannel(event.target.value as PlusOutcomeChannel | "")}
            disabled={state === "busy"}
            required
            autoFocus
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">—</option>
            {Object.entries(copy.channelOptions).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {compact ? (
          <div className="sm:col-span-2">
            <span className="text-xs font-bold text-foreground">{copy.artifact}</span>
            <output
              id={`plus-outcome-artifact-${item.memeId}`}
              className="mt-1 flex min-h-11 items-center rounded-lg border border-border bg-surface-2 px-3 text-base"
            >
              {copy.artifactOptions[artifactKind]}
            </output>
          </div>
        ) : (
          <div className="sm:col-span-2">
            <label htmlFor={`plus-outcome-artifact-${item.memeId}`} className="text-xs font-bold text-foreground">
              {copy.artifact}
            </label>
            <select
              id={`plus-outcome-artifact-${item.memeId}`}
              value={artifactKind}
              onChange={(event) => setArtifactKind(event.target.value as PlusOutcomeArtifactKind)}
              disabled={state === "busy"}
              className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {Object.entries(copy.artifactOptions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label htmlFor={`plus-outcome-url-${item.memeId}`} className="text-xs font-bold text-foreground">
            {copy.resultUrl} <span className="font-normal text-muted">({compact ? copy.requiredLabel : copy.optional})</span>
          </label>
          <input
            id={`plus-outcome-url-${item.memeId}`}
            type="url"
            inputMode="url"
            value={resultUrl}
            onChange={(event) => setResultUrl(event.target.value)}
            disabled={state === "busy"}
            maxLength={2048}
            placeholder={copy.urlPlaceholder}
            required={compact}
            className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        {!compact && <div className="sm:col-span-2">
          <label htmlFor={`plus-outcome-performance-${item.memeId}`} className="text-xs font-bold text-foreground">
            {copy.performance} <span className="font-normal text-muted">({copy.optional})</span>
          </label>
          <textarea
            id={`plus-outcome-performance-${item.memeId}`}
            value={performanceNote}
            onChange={(event) => setPerformanceNote(event.target.value)}
            disabled={state === "busy"}
            maxLength={1000}
            rows={2}
            placeholder={copy.performancePlaceholder}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>}

        {!compact && <div className="sm:col-span-2">
          <label htmlFor={`plus-outcome-note-${item.memeId}`} className="text-xs font-bold text-foreground">
            {copy.note} <span className="font-normal text-muted">({copy.optional})</span>
          </label>
          <textarea
            id={`plus-outcome-note-${item.memeId}`}
            value={privateNote}
            onChange={(event) => setPrivateNote(event.target.value)}
            disabled={state === "busy"}
            maxLength={1000}
            rows={2}
            placeholder={copy.notePlaceholder}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-base leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>}
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted">{copy.privacy}</p>
      {error && (
        <p className="mt-3 text-sm font-semibold text-safety-red" role="alert">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={state === "busy"}
          className="inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {state === "busy" ? copy.saving : copy.save}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={state === "busy"}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-bold text-accent-text disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copy.cancel}
        </button>
      </div>
    </form>
  );
}
