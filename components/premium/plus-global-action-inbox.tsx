"use client";

import Link from "next/link";
import type { ReactNode, Ref } from "react";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { LANGUAGE_NAMES, type Locale } from "@/lib/i18n";
import type {
  PlusGlobalActionInboxItem,
  PlusGlobalActionInboxResult,
  PlusGlobalActionKind,
} from "@/lib/plus-global-action-inbox";
import {
  buildPlusCreatorPack,
  creatorPackFormatForChannel,
  type PlusCreatorPackItem,
} from "@/lib/plus-creator-pack";
import {
  PlusOutcomeReceiptForm,
  type PlusOutcomeReceiptResponse,
} from "@/components/premium/plus-outcome-receipt-form";
import { PlusOutcomeFollowUp } from "@/components/premium/plus-outcome-follow-up";
import { PlusSevenDayUseSummary, type PlusSevenDayUseSummaryData } from "@/components/premium/plus-seven-day-use-summary";
import { PLUS_OUTCOME_COPY, type PlusOutcomeLedgerCopy } from "@/lib/plus-outcome-copy";
import { PlusNextMove } from "@/components/premium/plus-next-move";
import {
  buildPlusNextMove,
  type PlusNextMoveCopy,
  type PlusNextMoveRatingStatus,
  type PlusNextMoveResult,
} from "@/lib/plus-next-move";
import { buildPlusOutcomeChannelRecommendation } from "@/lib/plus-outcome-channel-recommendation";
import type {
  PlusOutcomeFollowUps,
  PlusOutcomeRating,
  PlusOutcomeRatingRow,
} from "@/lib/plus-outcome-ledger";
import type { PlusOutcomeChannel } from "@/lib/plus-outcome-ledger";

export type PlusGlobalActionInboxCopy = {
  eyebrow: string;
  heading: string;
  body: string;
  contentLanguageLabel: string;
  outcome: {
    ready: (count: number) => string;
    prepared: (count: number) => string;
    complete: (count: number, currentStreak: number) => string;
  };
  open: string;
  copyAction: string;
  shareAction: string;
  completeAction: string;
  completing: string;
  completed: string;
  actionFailed: string;
  completionUnavailable: string;
  progress: (completedTodayCount: number, currentStreak: number) => string;
  kindLabels: Record<PlusGlobalActionKind, string>;
  empty: { heading: string; body: string };
  unavailable: { heading: string; body: string };
  partialUnavailable: (count: number) => string;
  creatorPack: {
    title: string;
    body: string;
    exampleLabel: string;
    examplePreview: string;
    exampleUnavailable: string;
    includeMoreLabel: string;
    includeMoreDescription: string;
    create: string;
    channelRequired: string;
    recommended: (count: number) => string;
    preparing: string;
    shared: string;
    shareAgain: string;
    downloadAgain: string;
    reusable: (count: number) => string;
    fallback: string;
    downloaded: string;
    partial: (succeeded: number, failed: number) => string;
    error: string;
    empty: string;
    ready: (count: number) => string;
    complete: (count: number) => string;
    completing: string;
    completed: (count: number) => string;
    partialCompleted: (succeeded: number, failed: number) => string;
    completionError: string;
  };
};

export type PlusTodayOutcomeState = "ready" | "prepared" | "complete" | "empty" | "unavailable";

export function resolvePlusTodayOutcomeState({
  itemCount,
  preparedCount,
  completedTodayCount,
  resultStatus,
}: {
  itemCount: number;
  preparedCount: number;
  completedTodayCount: number;
  resultStatus: PlusGlobalActionInboxResult["status"];
}): PlusTodayOutcomeState {
  if (resultStatus === "unavailable") return "unavailable";
  if (preparedCount > 0) return "prepared";
  if (itemCount > 0) return "ready";
  if (completedTodayCount > 0) return "complete";
  return "empty";
}

export function PlusGlobalActionInbox({
  result,
  copy,
  outcomeSummary = EMPTY_OUTCOME_SUMMARY,
  outcomeFollowUps,
  outcomeCopy = PLUS_OUTCOME_COPY.en,
  nextMove,
  nextMoveCopy,
  mode = "inbox",
  entrySource,
  displayLocale,
}: {
  result: PlusGlobalActionInboxResult;
  copy: PlusGlobalActionInboxCopy;
  outcomeSummary?: PlusSevenDayUseSummaryData;
  outcomeFollowUps?: PlusOutcomeFollowUps;
  outcomeCopy?: PlusOutcomeLedgerCopy;
  nextMove?: {
    items?: readonly PlusGlobalActionInboxItem[];
    ratings: PlusOutcomeRatingRow[];
    ratingsStatus: PlusNextMoveRatingStatus;
  };
  nextMoveCopy?: PlusNextMoveCopy;
  mode?: "inbox" | "one_cut";
  entrySource?: "daily_signal" | "global_daily" | "outcome_history";
  displayLocale?: Locale;
}) {
  const isOneCut = mode === "one_cut";
  const [items, setItems] = useState(result.items);
  const [completedTodayCount, setCompletedTodayCount] = useState(
    result.completion.completedTodayCount,
  );
  const [currentStreak, setCurrentStreak] = useState(result.completion.currentStreak);
  const [status, setStatus] = useState<string | null>(null);
  const [creatorPackState, setCreatorPackState] = useState<CreatorPackState>("idle");
  const [creatorPackStatus, setCreatorPackStatus] = useState<string | null>(null);
  const creatorPackChannelTouchedRef = useRef(false);
  const [preparedCreatorPackChannel, setPreparedCreatorPackChannel] =
    useState<PlusOutcomeChannel | null>(null);
  const [preparedCreatorPackItems, setPreparedCreatorPackItems] = useState<PlusCreatorPackItem[]>([]);
  const [preparedCreatorPackFiles, setPreparedCreatorPackFiles] = useState<PreparedCreatorPackFile[]>([]);
  const [preparedCreatorPackFailedCount, setPreparedCreatorPackFailedCount] = useState(0);
  const [preparedCreatorPackReuseBusy, setPreparedCreatorPackReuseBusy] = useState(false);
  const preparedCreatorPackReuseBusyRef = useRef(false);
  const [creatorPackPreview, setCreatorPackPreview] = useState<PreparedCreatorPackPreview | null>(null);
  const [creatorPackCompletionState, setCreatorPackCompletionState] =
    useState<CreatorPackCompletionState>("idle");
  const [creatorPackCompletionStatus, setCreatorPackCompletionStatus] = useState<string | null>(null);
  const [pendingOutcomeItems, setPendingOutcomeItems] = useState<PlusGlobalActionInboxItem[]>([]);
  const [localOutcomeSummary, setLocalOutcomeSummary] = useState(outcomeSummary);
  const initialOutcomeRatings = nextMove?.ratings ?? [];
  const outcomeRatingsRef = useRef(initialOutcomeRatings);
  const [outcomeRatings, setOutcomeRatings] = useState(initialOutcomeRatings);
  const channelRecommendation =
    nextMove?.ratingsStatus === "available"
      ? buildPlusOutcomeChannelRecommendation(outcomeRatings)
      : null;
  const replayChannel = result.items.find((item) => item.kind === "outcome_replay")?.preferredOutcomeChannel;
  const [creatorPackChannel, setCreatorPackChannel] = useState<PlusOutcomeChannel | "">(
    replayChannel ?? channelRecommendation?.channel ?? "",
  );
  const [includeAdditionalCreatorPackItems, setIncludeAdditionalCreatorPackItems] = useState(false);
  const [creatorPackExampleSelections, setCreatorPackExampleSelections] = useState<
    Record<string, number>
  >({});
  const oneCutReadyTrackedRef = useRef(false);
  const firstActionCardRef = useRef<HTMLLIElement | null>(null);
  const focusFirstActionCardRef = useRef(false);
  const visibleItems = isOneCut ? items.slice(0, 1) : items;
  const creatorPackItems =
    isOneCut && !includeAdditionalCreatorPackItems ? visibleItems : items;
  const activePendingOutcomeItem = pendingOutcomeItems[0] ?? null;
  const todayOutcomeState = resolvePlusTodayOutcomeState({
    itemCount: visibleItems.length,
    preparedCount: preparedCreatorPackItems.length,
    completedTodayCount,
    resultStatus: result.status,
  });
  const nextMoveResult: PlusNextMoveResult | null = nextMove
    ? buildPlusNextMove({
        items: nextMove.items ?? items,
        ratings: outcomeRatings,
        ratingsStatus: nextMove.ratingsStatus,
        completedMemeIds: result.completion.completedMemeIds,
      })
    : null;
  const shouldRenderNextMove = Boolean(
    nextMoveResult &&
      nextMoveCopy &&
      (!isOneCut ||
        outcomeRatings.length > 0 ||
        (result.status === "empty" && nextMoveResult.status === "ready")),
  );
  const canActivateNextMove = Boolean(
    nextMoveResult?.status === "ready" &&
      nextMoveResult.item &&
      isOneCut &&
      result.status === "active" &&
      items.some((item) => item.memeId === nextMoveResult.item?.memeId) &&
      creatorPackState !== "busy" &&
      preparedCreatorPackItems.length === 0 &&
      preparedCreatorPackFiles.length === 0 &&
      pendingOutcomeItems.length === 0 &&
      !preparedCreatorPackReuseBusy,
  );

  useEffect(() => {
    return () => {
      if (creatorPackPreview) URL.revokeObjectURL(creatorPackPreview.objectUrl);
    };
  }, [creatorPackPreview]);

  useEffect(() => {
    if (
      !isOneCut ||
      oneCutReadyTrackedRef.current ||
      result.status !== "active" ||
      visibleItems.length === 0
    ) {
      return;
    }
    oneCutReadyTrackedRef.current = true;
    track("plus_one_cut_ready", {
      locale: visibleItems[0].locale,
      count: visibleItems.length,
      ...(entrySource ? { entry_source: entrySource } : {}),
    });
  }, [entrySource, isOneCut, result.status, visibleItems]);

  useEffect(() => {
    if (!focusFirstActionCardRef.current) return;
    focusFirstActionCardRef.current = false;
    firstActionCardRef.current?.focus();
  }, [items]);

  function handleOutcomeRated(
    item: { memeId: string; completionDate: string; channel: PlusOutcomeChannel },
    rating: PlusOutcomeRating,
  ): void {
    const nextRow = {
      memeId: item.memeId,
      completionDate: item.completionDate,
      channel: item.channel,
      rating,
    };
    const currentRatings = outcomeRatingsRef.current;
    const existingIndex = currentRatings.findIndex(
      (row) => row.memeId === item.memeId && row.completionDate === item.completionDate,
    );
    const nextRatings =
      existingIndex < 0
        ? [...currentRatings, nextRow]
        : currentRatings.map((row, index) => (index === existingIndex ? nextRow : row));
    outcomeRatingsRef.current = nextRatings;
    setOutcomeRatings(nextRatings);
    if (
      nextMove?.ratingsStatus === "available" &&
      !creatorPackChannelTouchedRef.current
    ) {
      setCreatorPackChannel(buildPlusOutcomeChannelRecommendation(nextRatings)?.channel ?? "");
    }
  }

  function activateNextMove(memeId: string): void {
    if (!canActivateNextMove || !nextMoveCopy) return;
    const candidate = items.find((item) => item.memeId === memeId);
    if (!candidate) return;
    focusFirstActionCardRef.current = true;
    setItems((current) => {
      const selected = current.find((item) => item.memeId === memeId);
      return selected
        ? [selected, ...current.filter((item) => item.memeId !== memeId)]
        : current;
    });
    setIncludeAdditionalCreatorPackItems(false);
    setCreatorPackExampleSelections({});
    setCreatorPackState("idle");
    setCreatorPackStatus(null);
    setCreatorPackCompletionStatus(null);
    setStatus(nextMoveCopy.activated);
  }

  async function copyItem(item: PlusGlobalActionInboxItem): Promise<void> {
    setStatus(null);
    try {
      await navigator.clipboard.writeText(toShareText(item));
      setStatus(copy.copyAction);
    } catch {
      setStatus(copy.actionFailed);
    }
  }

  async function shareItem(item: PlusGlobalActionInboxItem): Promise<void> {
    setStatus(null);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: item.title, text: toShareText(item) });
        setStatus(copy.shareAction);
        return;
      }
      await navigator.clipboard.writeText(toShareText(item));
      setStatus(copy.copyAction);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus(copy.actionFailed);
    }
  }

  function completeItem(item: PlusGlobalActionInboxItem): void {
    if (pendingOutcomeItems.some((candidate) => candidate.memeId === item.memeId)) return;
    setStatus(null);
    setPendingOutcomeItems((current) => [...current, item]);
  }

  async function createCreatorPack(): Promise<void> {
    if (creatorPackState === "busy" || creatorPackItems.length === 0) return;
    if (!creatorPackChannel) {
      setCreatorPackState("error");
      setCreatorPackStatus(copy.creatorPack.channelRequired);
      return;
    }
    setCreatorPackState("busy");
    setCreatorPackStatus(null);
    setPreparedCreatorPackItems([]);
    setPreparedCreatorPackFiles([]);
    setPreparedCreatorPackFailedCount(0);
    setPreparedCreatorPackChannel(null);
    setCreatorPackPreview(null);
    setCreatorPackCompletionState("idle");
    setCreatorPackCompletionStatus(null);

    try {
      const pack = buildPlusCreatorPack({
        items: creatorPackItems,
        usageExampleIndexes: Object.fromEntries(
          creatorPackItems.map((item) => [
            item.memeId,
            selectedCreatorPackExampleIndexFor(item, creatorPackExampleSelections),
          ]),
        ),
        channel: creatorPackChannel,
      });
      const format = creatorPackFormatForChannel(creatorPackChannel);
      if (pack.status === "empty") {
        setCreatorPackState("error");
        setCreatorPackStatus(copy.creatorPack.empty);
        return;
      }

      const results = await Promise.allSettled(
        pack.items.map(async (item) => {
          const response = await fetch(creatorExportUrl(item.exportPath, format), { cache: "no-store" });
          if (!response.ok) throw new Error(`export_${response.status}`);
          return { item, blob: await response.blob() };
        }),
      );
      const successful = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      const failedCount = pack.skippedCount + results.filter((result) => result.status === "rejected").length;
      if (successful.length === 0) throw new Error("creator_pack_exports_failed");
      setPreparedCreatorPackItems(successful.map(({ item }) => item));
      setPreparedCreatorPackFiles(successful);
      setPreparedCreatorPackFailedCount(failedCount);
      setPreparedCreatorPackChannel(creatorPackChannel);
      track("plus_one_cut_prepared", {
        locale: successful[0].item.locale,
        count: successful.length,
        ...(entrySource ? { entry_source: entrySource } : {}),
      });
      if (isOneCut && typeof URL.createObjectURL === "function") {
        setCreatorPackPreview({
          item: successful[0].item,
          objectUrl: URL.createObjectURL(successful[0].blob),
        });
      }
      const files = successful.map(({ item, blob }) =>
        new File([blob], item.filename, { type: "image/png" }),
      );
      const shareText = successful
        .map(({ item }) => absoluteShareText(item.shareText, item.detailPath))
        .join("\n\n---\n\n");
      let canShareFiles = false;
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
        try {
          canShareFiles = navigator.canShare({ files });
        } catch {
          canShareFiles = false;
        }
      }

      if (canShareFiles) {
        try {
          await navigator.share({
            title: copy.creatorPack.title,
            text: shareText,
            files,
          });
          setCreatorPackState(failedCount > 0 ? "partial" : "shared");
          setCreatorPackStatus(
            failedCount > 0
              ? copy.creatorPack.partial(successful.length, failedCount)
              : copy.creatorPack.shared,
          );
          return;
        } catch (error) {
          if (isShareCancelled(error)) {
            setCreatorPackState("idle");
            setCreatorPackStatus(
              failedCount > 0
                ? copy.creatorPack.partial(successful.length, failedCount)
                : copy.creatorPack.ready(successful.length),
            );
            return;
          }
        }
      }

      let copied = false;
      try {
        await navigator.clipboard.writeText(shareText);
        copied = true;
      } catch {
      }
      successful.forEach(({ item, blob }) => downloadCard(blob, item.filename));
      setCreatorPackState(failedCount > 0 ? "partial" : copied ? "fallback" : "downloaded");
      setCreatorPackStatus(
        failedCount > 0
          ? copy.creatorPack.partial(successful.length, failedCount)
          : copied
            ? copy.creatorPack.fallback
            : copy.creatorPack.downloaded,
      );
    } catch {
      setCreatorPackState("error");
      setCreatorPackStatus(copy.creatorPack.error);
    }
  }

  async function sharePreparedCreatorPack(): Promise<void> {
    if (preparedCreatorPackFiles.length === 0 || preparedCreatorPackReuseBusyRef.current) return;
    preparedCreatorPackReuseBusyRef.current = true;
    setPreparedCreatorPackReuseBusy(true);
    setCreatorPackStatus(null);
    try {
      const files = preparedCreatorPackFiles.map(({ item, blob }) =>
        new File([blob], item.filename, { type: "image/png" }),
      );
      const shareText = preparedCreatorPackFiles
        .map(({ item }) => absoluteShareText(item.shareText, item.detailPath))
        .join("\n\n---\n\n");
      let canShareFiles = false;
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
        try {
          canShareFiles = navigator.canShare({ files });
        } catch {
          canShareFiles = false;
        }
      }

      if (canShareFiles) {
        try {
          await navigator.share({
            title: copy.creatorPack.title,
            text: shareText,
            files,
          });
          setCreatorPackState(preparedCreatorPackFailedCount > 0 ? "partial" : "shared");
          setCreatorPackStatus(
            preparedCreatorPackFailedCount > 0
              ? copy.creatorPack.partial(preparedCreatorPackFiles.length, preparedCreatorPackFailedCount)
              : copy.creatorPack.shared,
          );
          return;
        } catch (error) {
          if (isShareCancelled(error)) {
            setCreatorPackStatus(
              preparedCreatorPackFailedCount > 0
                ? copy.creatorPack.partial(preparedCreatorPackFiles.length, preparedCreatorPackFailedCount)
                : copy.creatorPack.reusable(preparedCreatorPackFiles.length),
            );
            return;
          }
        }
      }

      let copied = false;
      try {
        await navigator.clipboard.writeText(shareText);
        copied = true;
      } catch {
      }
      preparedCreatorPackFiles.forEach(({ item, blob }) => downloadCard(blob, item.filename));
      setCreatorPackState(preparedCreatorPackFailedCount > 0 ? "partial" : copied ? "fallback" : "downloaded");
      setCreatorPackStatus(
        preparedCreatorPackFailedCount > 0
          ? copy.creatorPack.partial(preparedCreatorPackFiles.length, preparedCreatorPackFailedCount)
          : copied
            ? copy.creatorPack.fallback
            : copy.creatorPack.downloaded,
      );
    } catch {
      setCreatorPackState("error");
      setCreatorPackStatus(copy.creatorPack.error);
    } finally {
      preparedCreatorPackReuseBusyRef.current = false;
      setPreparedCreatorPackReuseBusy(false);
    }
  }

  function downloadPreparedCreatorPackItem(itemId: string): void {
    if (preparedCreatorPackReuseBusyRef.current) return;
    const prepared = preparedCreatorPackFiles.find(({ item }) => item.memeId === itemId);
    if (!prepared) return;
    downloadCard(prepared.blob, prepared.item.filename);
    setCreatorPackState(preparedCreatorPackFailedCount > 0 ? "partial" : "downloaded");
    setCreatorPackStatus(
      preparedCreatorPackFailedCount > 0
        ? copy.creatorPack.partial(preparedCreatorPackFiles.length, preparedCreatorPackFailedCount)
        : copy.creatorPack.downloaded,
    );
  }

  function confirmCreatorPack(): void {
    if (
      preparedCreatorPackItems.length === 0 ||
      result.completion.status !== "available"
    ) {
      return;
    }
    const preparedActions = preparedCreatorPackItems.flatMap((prepared) => {
      const action = items.find((candidate) => candidate.memeId === prepared.memeId);
      return action ? [action] : [];
    });
    setPendingOutcomeItems((current) => {
      const existing = new Set(current.map((item) => item.memeId));
      return [...current, ...preparedActions.filter((item) => !existing.has(item.memeId))];
    });
    setCreatorPackCompletionStatus(null);
  }

  function handleOutcomeSaved(item: PlusGlobalActionInboxItem, receipt: PlusOutcomeReceiptResponse): void {
    const wasPrepared = preparedCreatorPackItems.some((candidate) => candidate.memeId === item.memeId);
    const remainingPending = pendingOutcomeItems.filter((candidate) => candidate.memeId !== item.memeId);
    setItems((current) => current.filter((candidate) => candidate.memeId !== item.memeId));
    setPreparedCreatorPackItems((current) =>
      current.filter((candidate) => candidate.memeId !== item.memeId),
    );
    if (remainingPending.length === 0) setPreparedCreatorPackChannel(null);
    setCreatorPackPreview((current) =>
      current?.item.memeId === item.memeId ? null : current,
    );
    setPendingOutcomeItems(remainingPending);
    setCompletedTodayCount(receipt.completedTodayCount);
    setCurrentStreak(receipt.currentStreak);
    if (!receipt.alreadyRecorded) {
      setLocalOutcomeSummary((current) => addReceiptToSummary(current, receipt));
    }
    track("plus_receipt_saved", {
      locale: receipt.locale,
      channel: receipt.channel,
      artifact_kind: receipt.artifactKind,
      already_recorded: receipt.alreadyRecorded ? 1 : 0,
      ...(entrySource ? { entry_source: entrySource } : {}),
    });
    if (wasPrepared) {
      setCreatorPackCompletionState(remainingPending.length > 0 ? "partial" : "done");
      setCreatorPackCompletionStatus(
        remainingPending.length > 0
          ? copy.creatorPack.partialCompleted(1, remainingPending.length)
          : copy.creatorPack.completed(1),
      );
    }
    setStatus(copy.completed);
  }

  function renderOutcomeForm(item: PlusGlobalActionInboxItem, compact: boolean): ReactNode {
    return (
      <PlusOutcomeReceiptForm
        item={item}
        copy={outcomeCopy.receipt}
        defaultChannel={preparedCreatorPackChannel ?? undefined}
        defaultArtifactKind={
          preparedCreatorPackItems.some((candidate) => candidate.memeId === item.memeId)
            ? "creator_pack"
            : "caption"
        }
        compact={compact}
        onCancel={() =>
          setPendingOutcomeItems((current) =>
            current.filter((candidate) => candidate.memeId !== item.memeId),
          )
        }
        onSaved={(receipt) => handleOutcomeSaved(item, receipt)}
      />
    );
  }

  const actionCards = visibleItems.length > 0 ? (
    <ol className="mt-5 grid gap-3 lg:grid-cols-2">
      {visibleItems.map((item, index) => (
        <ActionCard
          key={item.memeId}
          cardRef={index === 0 ? firstActionCardRef : undefined}
          item={item}
          index={index}
          copy={copy}
          contentLanguageLabel={copy.contentLanguageLabel}
          displayLocale={displayLocale}
          canComplete={!isOneCut && result.completion.status === "available"}
          pending={pendingOutcomeItems.some((candidate) => candidate.memeId === item.memeId)}
          onCopy={() => void copyItem(item)}
          onShare={() => void shareItem(item)}
          onComplete={() => void completeItem(item)}
          outcomeForm={isOneCut ? null : activePendingOutcomeItem?.memeId === item.memeId ? renderOutcomeForm(item, false) : null}
        />
      ))}
    </ol>
  ) : null;

  const creatorPackControls = visibleItems.length > 0 ? (
    <div
      data-plus-creator-pack={creatorPackState}
      className="mt-4 flex flex-col gap-3 rounded-xl border border-accent/30 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-black text-accent-text">{copy.creatorPack.title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">{copy.creatorPack.body}</p>
        {isOneCut && items.length > 1 && (
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-muted">
            <input
              type="checkbox"
              checked={includeAdditionalCreatorPackItems}
              onChange={(event) => setIncludeAdditionalCreatorPackItems(event.target.checked)}
              disabled={creatorPackState === "busy"}
              className="mt-0.5 size-4 shrink-0 accent-accent-strong"
            />
            <span>
              <span className="block font-bold text-foreground">{copy.creatorPack.includeMoreLabel}</span>
              <span className="block">{copy.creatorPack.includeMoreDescription}</span>
            </span>
          </label>
        )}
        {visibleItems.length > 0 && (
          <div
            className="mt-3 grid gap-3 rounded-lg border border-border bg-surface-2 p-3"
            data-plus-creator-pack-examples={isOneCut && creatorPackItems.length === 1 ? "one_cut" : "pack"}
          >
            {creatorPackItems.map((item) => {
              const examples = item.creatorPackFacts?.usageExamples ?? [];
              const selectedIndex = selectedCreatorPackExampleIndexFor(
                item,
                creatorPackExampleSelections,
              );
              const selectedExample = selectedIndex === null ? null : examples[selectedIndex] ?? null;
              const isSingleOneCut = isOneCut && creatorPackItems.length === 1;
              const inputId = isSingleOneCut
                ? "plus-creator-pack-example"
                : `plus-creator-pack-example-${item.memeId}`;
              const label = isSingleOneCut
                ? copy.creatorPack.exampleLabel
                : `${item.title} · ${copy.creatorPack.exampleLabel}`;

              return (
                <div key={item.memeId} className="min-w-0">
                  <label htmlFor={inputId} className="block text-xs font-bold text-foreground">
                    {label}
                  </label>
                  {examples.length > 0 ? (
                    <>
                      <select
                        id={inputId}
                        aria-label={label}
                        value={selectedIndex ?? 0}
                        onChange={(event) =>
                          setCreatorPackExampleSelections((current) => ({
                            ...current,
                            [item.memeId]: Number(event.target.value),
                          }))
                        }
                        disabled={creatorPackState === "busy"}
                        className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {examples.map((example, index) => (
                          <option key={`${example.situation}:${index}`} value={index}>
                            {example.situation}
                          </option>
                        ))}
                      </select>
                      {selectedExample && (
                        <p
                          data-plus-creator-pack-example={item.memeId}
                          className="mt-2 text-xs leading-relaxed text-muted"
                        >
                          {copy.creatorPack.examplePreview}: {selectedExample.text}
                        </p>
                      )}
                    </>
                  ) : (
                    <p
                      data-plus-creator-pack-example-unavailable={item.memeId}
                      className="mt-1 text-xs leading-relaxed text-muted"
                    >
                      {copy.creatorPack.exampleUnavailable}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <label htmlFor="plus-creator-pack-channel" className="mt-3 block text-xs font-bold text-foreground">
          {outcomeCopy.receipt.channel}
        </label>
        <select
          id="plus-creator-pack-channel"
          value={creatorPackChannel}
          onChange={(event) => {
            creatorPackChannelTouchedRef.current = true;
            setCreatorPackChannel(event.target.value as PlusOutcomeChannel | "");
          }}
          disabled={creatorPackState === "busy"}
          className="mt-1 min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:max-w-xs"
        >
          <option value="">—</option>
          {Object.entries(outcomeCopy.receipt.channelOptions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {channelRecommendation && (
          <p
            data-plus-creator-pack-recommendation
            className="mt-2 text-xs font-semibold text-accent-text"
            role="status"
          >
            {copy.creatorPack.recommended(channelRecommendation.sampleCount)}:{" "}
            {outcomeCopy.receipt.channelOptions[channelRecommendation.channel]}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void createCreatorPack()}
        disabled={creatorPackState === "busy" || preparedCreatorPackReuseBusy}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-accent-strong px-3 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {creatorPackState === "busy" ? copy.creatorPack.preparing : copy.creatorPack.create}
      </button>
    </div>
  ) : null;

  const creatorPackReceipt = preparedCreatorPackFiles.length > 0 ? (
    <div
      data-plus-creator-pack-receipt={creatorPackCompletionState}
      className="mt-3 flex flex-col gap-3 rounded-xl border border-accent/30 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm font-semibold text-accent-text" role="status">
        {preparedCreatorPackItems.length > 0
          ? copy.creatorPack.ready(preparedCreatorPackItems.length)
          : copy.creatorPack.reusable(preparedCreatorPackFiles.length)}
      </p>
      <div className="flex flex-wrap gap-2 sm:justify-end" data-plus-creator-pack-reuse>
        <button
          type="button"
          onClick={() => void sharePreparedCreatorPack()}
          disabled={preparedCreatorPackReuseBusy}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-accent px-3 text-xs font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {copy.creatorPack.shareAgain}
        </button>
        {preparedCreatorPackFiles.map(({ item }) => (
          <button
            key={item.memeId}
            type="button"
            onClick={() => downloadPreparedCreatorPackItem(item.memeId)}
            disabled={preparedCreatorPackReuseBusy}
            aria-label={`${copy.creatorPack.downloadAgain}: ${item.title}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-border px-3 text-xs font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.creatorPack.downloadAgain}
          </button>
        ))}
        {preparedCreatorPackItems.length > 0
          ? result.completion.status === "available"
            ? (
                <button
                  type="button"
                  onClick={() => void confirmCreatorPack()}
                  disabled={creatorPackCompletionState === "busy" || pendingOutcomeItems.length > 0}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-accent-strong px-3 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {creatorPackCompletionState === "busy"
                    ? copy.creatorPack.completing
                    : copy.creatorPack.complete(preparedCreatorPackItems.length)}
                </button>
              )
            : (
                <p className="text-xs font-semibold text-safety-yellow" role="status">
                  {copy.completionUnavailable}
                </p>
              )
          : null}
      </div>
    </div>
  ) : null;

  const creatorPackPreviewElement = isOneCut && creatorPackPreview ? (
    <PreparedCreatorCardPreview
      preview={creatorPackPreview}
      label={copy.creatorPack.title}
    />
  ) : null;

  const creatorPackStatusMessage = creatorPackStatus ? (
    <p
      role={creatorPackState === "error" ? "alert" : "status"}
      className={`mt-3 text-xs font-semibold ${creatorPackState === "error" ? "text-safety-red" : "text-muted"}`}
    >
      {creatorPackStatus}
    </p>
  ) : null;

  const creatorPackCompletionMessage = creatorPackCompletionStatus ? (
    <p
      role={creatorPackCompletionState === "error" ? "alert" : "status"}
      className={`mt-3 text-xs font-semibold ${creatorPackCompletionState === "error" ? "text-safety-red" : "text-muted"}`}
    >
      {creatorPackCompletionStatus}
    </p>
  ) : null;

  const oneCutOutcomeForm = isOneCut && activePendingOutcomeItem ? (
    <div
      data-plus-one-cut-receipt
      className="mt-3 rounded-xl border border-accent/30 bg-surface p-4"
    >
      {renderOutcomeForm(activePendingOutcomeItem, true)}
    </div>
  ) : null;

  const oneCutOutcomeFollowUp = isOneCut && outcomeFollowUps?.status === "ready" ? (
    <div data-plus-one-cut-follow-up>
      <PlusOutcomeFollowUp
        items={outcomeFollowUps.items}
        copy={outcomeCopy}
        onSaved={() =>
          setLocalOutcomeSummary((current) => {
            if (!current || current.status === "locked" || current.status === "unavailable") {
              return current;
            }
            return {
              ...current,
              awaitingPerformanceCount: Math.max(0, current.awaitingPerformanceCount - 1),
            };
          })
        }
        onRated={handleOutcomeRated}
      />
    </div>
  ) : null;

  return (
    <section
      aria-labelledby="plus-global-action-inbox-title"
      data-plus-global-action-inbox={result.status}
      data-plus-action-mode={mode}
      data-action-completion-status={result.completion.status}
      className="mb-6 rounded-2xl border border-accent/40 bg-accent-soft/30 p-5 sm:p-6"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
        {copy.eyebrow}
      </p>
      <h2 id="plus-global-action-inbox-title" className="mt-1 text-xl font-black tracking-tight">
        {copy.heading}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{copy.body}</p>
      {result.completion.status === "available" ? (
        <p className="mt-3 text-xs font-semibold text-accent-text" role="status">
          {copy.progress(completedTodayCount, currentStreak)}
        </p>
      ) : (
        <p className="mt-3 text-xs font-semibold text-safety-yellow" role="status">
          {copy.completionUnavailable}
        </p>
      )}
      {!isOneCut && nextMoveResult && nextMoveCopy && (
        <PlusNextMove
          result={nextMoveResult}
          copy={nextMoveCopy}
          onActivate={canActivateNextMove ? activateNextMove : undefined}
        />
      )}
      {!isOneCut && (
        <PlusSevenDayUseSummary
          summary={localOutcomeSummary}
          followUps={outcomeFollowUps}
          copy={outcomeCopy}
          onRated={handleOutcomeRated}
        />
      )}

      {(todayOutcomeState === "ready" ||
        todayOutcomeState === "prepared" ||
        todayOutcomeState === "complete") && (
        <div
          data-plus-today-outcome={todayOutcomeState}
          aria-live="polite"
          className="mt-4 rounded-xl border border-accent/30 bg-surface px-4 py-3"
        >
          <p className="text-sm font-black text-accent-text">
            {todayOutcomeState === "ready"
              ? copy.outcome.ready(visibleItems.length)
              : todayOutcomeState === "prepared"
                ? copy.outcome.prepared(preparedCreatorPackItems.length)
                : copy.outcome.complete(completedTodayCount, currentStreak)}
          </p>
        </div>
      )}

      {isOneCut ? (
        <>
          {actionCards}
          {creatorPackControls}
          {creatorPackReceipt}
          {creatorPackPreviewElement}
          {creatorPackStatusMessage}
          {creatorPackCompletionMessage}
          {oneCutOutcomeForm}
          {oneCutOutcomeFollowUp}
          {isOneCut && shouldRenderNextMove && nextMoveResult && nextMoveCopy && (
            <PlusNextMove
              result={nextMoveResult}
              copy={nextMoveCopy}
              onActivate={canActivateNextMove ? activateNextMove : undefined}
            />
          )}
        </>
      ) : (
        <>
          {creatorPackControls}
          {creatorPackReceipt}
          {creatorPackPreviewElement}
          {creatorPackStatusMessage}
          {creatorPackCompletionMessage}
          {actionCards}
        </>
      )}

      {status && (
        <p className="mt-4 text-xs font-semibold text-muted" role="status" aria-live="polite">
          {status}
        </p>
      )}

      {visibleItems.length > 0 && result.unavailableLanes.length > 0 && (
        <p className="mt-4 rounded-xl bg-safety-yellow-bg px-3 py-2.5 text-sm font-semibold text-safety-yellow" role="status">
          {copy.partialUnavailable(result.unavailableLanes.length)}
        </p>
      )}

      {visibleItems.length === 0 && todayOutcomeState === "empty" && <InboxMessage copy={copy.empty} />}
      {visibleItems.length === 0 && todayOutcomeState === "unavailable" && <InboxMessage copy={copy.unavailable} />}
    </section>
  );
}

type CreatorPackState = "idle" | "busy" | "shared" | "fallback" | "downloaded" | "partial" | "error";
type CreatorPackCompletionState = "idle" | "busy" | "done" | "partial" | "error";
type PreparedCreatorPackPreview = {
  item: PlusCreatorPackItem;
  objectUrl: string;
};
type PreparedCreatorPackFile = {
  item: PlusCreatorPackItem;
  blob: Blob;
};

function selectedCreatorPackExampleIndexFor(
  item: PlusGlobalActionInboxItem,
  selections: Readonly<Record<string, number>>,
): number | null {
  const examples = item.creatorPackFacts?.usageExamples ?? [];
  if (examples.length === 0) return null;
  const selectedIndex = selections[item.memeId] ?? 0;
  return examples[selectedIndex] ? selectedIndex : 0;
}

function creatorExportUrl(path: string, format: "card" | "story"): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}template=minimal&format=${format}&scale=1`;
}

function absoluteShareText(value: string, detailPath: string): string {
  return value
    .split("\n")
    .map((line) => {
      if (line !== detailPath) return line;
      try {
        return new URL(line, window.location.origin).toString();
      } catch {
        return line;
      }
    })
    .join("\n");
}

function downloadCard(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function isShareCancelled(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function toShareText(item: PlusGlobalActionInboxItem): string {
  return item.shareText.replace(item.href, new URL(item.href, window.location.origin).toString());
}

function ActionCard({
  item,
  index,
  cardRef,
  copy,
  contentLanguageLabel,
  displayLocale,
  canComplete,
  pending,
  onCopy,
  onShare,
  onComplete,
  outcomeForm,
}: {
  item: PlusGlobalActionInboxItem;
  index: number;
  cardRef?: Ref<HTMLLIElement>;
  copy: PlusGlobalActionInboxCopy;
  contentLanguageLabel: string;
  displayLocale?: Locale;
  canComplete: boolean;
  pending: boolean;
  onCopy: () => void;
  onShare: () => void;
  onComplete: () => void;
  outcomeForm: ReactNode;
}) {
  return (
    <li
      ref={cardRef}
      tabIndex={cardRef ? -1 : undefined}
      data-action-kind={item.kind}
      className="min-w-0 rounded-xl border border-border bg-surface p-4"
    >
      <Link
        href={item.href}
        className="group flex items-start gap-3 transition-colors hover:text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-strong text-sm font-black text-white">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-[0.1em] text-accent-text">
            {copy.kindLabels[item.kind]}
            {item.kind === "translation_ready" ? ` · ${LANGUAGE_NAMES[item.locale]}` : null}
          </span>
          {displayLocale && item.locale !== displayLocale && (
            <span className="mt-1 block text-xs font-semibold text-muted">
              {contentLanguageLabel}: {LANGUAGE_NAMES[item.locale]}
            </span>
          )}
          <span className="mt-1 block text-base font-bold leading-snug group-hover:text-accent-text">
            {item.title}
          </span>
          {item.summary && (
            <span className="mt-1 block text-sm leading-relaxed text-muted">{item.summary}</span>
          )}
          <span className="mt-3 block text-xs font-bold text-accent-text">
            {copy.open}
            <span aria-hidden> →</span>
          </span>
        </span>
      </Link>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copy.copyAction}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-xs font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {copy.shareAction}
        </button>
        {canComplete && (
          <button
            type="button"
            onClick={onComplete}
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-lg bg-accent-strong px-3 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {pending ? copy.completing : copy.completeAction}
          </button>
        )}
      </div>
      {outcomeForm}
    </li>
  );
}

function PreparedCreatorCardPreview({
  preview,
  label,
}: {
  preview: PreparedCreatorPackPreview;
  label: string;
}) {
  return (
    <div
      data-plus-creator-pack-preview
      className="mt-3 grid gap-4 rounded-xl border border-accent/30 bg-surface p-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-start"
    >
      <div className="overflow-hidden rounded-lg border border-border bg-surface-2">
        <img
          src={preview.objectUrl}
          alt={preview.item.title}
          className="block h-auto max-h-[32rem] w-full object-contain"
        />
      </div>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-accent-text">
          {label}
        </p>
        <p className="mt-2 text-sm font-bold">{preview.item.title}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted">
          {preview.item.shareText}
        </p>
      </div>
    </div>
  );
}

function InboxMessage({ copy }: { copy: { heading: string; body: string } }) {
  return (
    <div className="mt-5 rounded-xl border border-border bg-surface p-4" role="status">
      <h3 className="font-bold">{copy.heading}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{copy.body}</p>
    </div>
  );
}

const EMPTY_OUTCOME_SUMMARY: PlusSevenDayUseSummaryData = {
  status: "empty",
  fromDate: "",
  toDate: "",
  totalReceipts: 0,
  totalCompletions: 0,
  pendingReceiptCount: 0,
  awaitingPerformanceCount: 0,
  byChannel: [],
  byLocale: [],
  byArtifactKind: [],
};

function addReceiptToSummary(
  summary: PlusSevenDayUseSummaryData,
  receipt: PlusOutcomeReceiptResponse,
): PlusSevenDayUseSummaryData {
  if (summary.status === "locked" || summary.status === "unavailable") return summary;
  return {
    ...summary,
    status: "ready",
    totalReceipts: summary.totalReceipts + 1,
    totalCompletions: summary.totalCompletions + 1,
    awaitingPerformanceCount:
      summary.awaitingPerformanceCount + (receipt.performanceNote ? 0 : 1),
    byChannel: incrementBucket(summary.byChannel, receipt.channel),
    byLocale: incrementBucket(summary.byLocale, receipt.locale),
    byArtifactKind: incrementBucket(summary.byArtifactKind, receipt.artifactKind),
  };
}

function incrementBucket(
  buckets: readonly { key: string; count: number }[],
  key: string,
): { key: string; count: number }[] {
  const found = buckets.find((bucket) => bucket.key === key);
  if (!found) return [...buckets, { key, count: 1 }];
  return buckets.map((bucket) =>
    bucket.key === key ? { ...bucket, count: bucket.count + 1 } : bucket,
  );
}
