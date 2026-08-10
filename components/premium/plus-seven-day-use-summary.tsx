"use client";

import { useState } from "react";
import type { PlusOutcomeLedgerCopy } from "@/lib/plus-outcome-copy";
import type {
  PlusOutcomeChannel,
  PlusOutcomeFollowUps,
  PlusOutcomeRating,
} from "@/lib/plus-outcome-ledger";
import { PlusOutcomeFollowUp } from "@/components/premium/plus-outcome-follow-up";

export type PlusSevenDayUseSummaryData = {
  status: "locked" | "empty" | "ready" | "unavailable";
  fromDate: string | null;
  toDate: string | null;
  totalReceipts: number;
  totalCompletions: number;
  pendingReceiptCount: number;
  awaitingPerformanceCount: number;
  byChannel: readonly { key: string; count: number }[];
  byLocale: readonly { key: string; count: number }[];
  byArtifactKind: readonly { key: string; count: number }[];
};

export function PlusSevenDayUseSummary({
  summary,
  copy,
  followUps,
  onRated,
}: {
  summary: PlusSevenDayUseSummaryData;
  copy: PlusOutcomeLedgerCopy;
  followUps?: PlusOutcomeFollowUps;
  onRated?: (
    item: { receiptId: string; memeId: string; completionDate: string; channel: PlusOutcomeChannel },
    rating: PlusOutcomeRating,
  ) => void;
}) {
  const [currentSummary, setCurrentSummary] = useState(summary);

  if (currentSummary.status === "locked") return null;

  if (currentSummary.status === "unavailable") {
    return (
      <section
        data-plus-outcome-summary="unavailable"
        className="mt-4 rounded-xl border border-border bg-surface p-4"
        aria-label={copy.summary.title}
      >
        <p className="text-sm font-bold text-safety-yellow" role="status">
          {copy.summary.unavailable}
        </p>
      </section>
    );
  }

  if (currentSummary.status === "empty") {
    return (
      <section
        data-plus-outcome-summary="empty"
        className="mt-4 rounded-xl border border-border bg-surface p-4"
        aria-label={copy.summary.title}
      >
        <h3 className="text-sm font-black text-accent-text">{copy.summary.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{copy.summary.empty}</p>
      </section>
    );
  }

  return (
    <details
      data-plus-outcome-summary="ready"
      open
      className="mt-4 rounded-xl border border-accent/30 bg-surface p-4"
    >
      <summary className="cursor-pointer list-none text-sm font-black text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
        <span>{copy.summary.title}</span>
        <span className="ml-2 font-normal text-muted">
          {copy.summary.total(currentSummary.totalReceipts)}
        </span>
      </summary>
      <div className="mt-3 border-t border-border pt-3">
        <p className="text-xs leading-relaxed text-muted">{copy.summary.description}</p>
        <p className="text-xs text-muted">
          {currentSummary.fromDate}–{currentSummary.toDate} · Asia/Seoul
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Metric label={copy.summary.total(currentSummary.totalReceipts)} value={currentSummary.totalReceipts} />
          <Metric
            label={copy.summary.pendingReceipt(currentSummary.pendingReceiptCount)}
            value={currentSummary.pendingReceiptCount}
          />
          <Metric
            label={copy.summary.pendingPerformance(currentSummary.awaitingPerformanceCount)}
            value={currentSummary.awaitingPerformanceCount}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <BucketList
            title={copy.summary.channels}
            items={currentSummary.byChannel}
            label={(key) => copy.receipt.channelOptions[key as keyof typeof copy.receipt.channelOptions] ?? key}
          />
          <BucketList
            title={copy.summary.locales}
            items={currentSummary.byLocale}
            label={(key) =>
              copy.summary.localeNames[key as keyof typeof copy.summary.localeNames] ?? key
            }
          />
          <BucketList
            title={copy.summary.artifacts}
            items={currentSummary.byArtifactKind}
            label={(key) => copy.receipt.artifactOptions[key as keyof typeof copy.receipt.artifactOptions] ?? key}
          />
        </div>
        {followUps?.status === "ready" && (
          <PlusOutcomeFollowUp
            items={followUps.items}
            copy={copy}
            onSaved={() =>
              setCurrentSummary((current) => ({
                ...current,
                awaitingPerformanceCount: Math.max(0, current.awaitingPerformanceCount - 1),
              }))
            }
            onRated={onRated}
          />
        )}
      </div>
    </details>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-foreground">{value}</p>
    </div>
  );
}

function BucketList({
  title,
  items,
  label,
}: {
  title: string;
  items: readonly { key: string; count: number }[];
  label: (key: string) => string;
}) {
  return (
    <div>
      <h4 className="text-xs font-black uppercase tracking-[0.08em] text-muted">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-muted">—</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.key} className="flex items-baseline justify-between gap-2">
              <span className="truncate">{label(item.key)}</span>
              <span className="font-mono font-bold text-accent-text">{item.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
