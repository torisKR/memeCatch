"use client";

import { useState } from "react";
import { buildPlusDailySharePack } from "@/lib/plus-daily-share-pack";
import {
  PLUS_DAILY_SHARE_COPY,
  type PlusDailyShareLocale,
} from "@/lib/plus-daily-share-copy";
import type { PlusDailySignalCandidate } from "@/lib/plus-daily-signal.server";

function exportUrl(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}template=minimal&format=card&scale=1`;
}

function safeFilename(shortId: string): string {
  const safeId = shortId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "meme";
  return `memecatch-${safeId}-share.png`;
}

function downloadCard(blob: Blob, filename: string) {
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

export function PlusDailyShareAction({
  candidate,
  locale,
}: {
  candidate: PlusDailySignalCandidate;
  locale: PlusDailyShareLocale;
}) {
  const copy = PLUS_DAILY_SHARE_COPY[locale];
  const [state, setState] = useState<"idle" | "busy" | "shared" | "fallback" | "downloaded" | "error">("idle");

  async function createSharePack() {
    if (state === "busy") return;
    setState("busy");

    try {
      const pack = buildPlusDailySharePack({
        locale,
        shortId: candidate.shortId,
        slug: candidate.slug,
        facts: {
          title: candidate.title,
          summary: candidate.summary,
          usageNote: candidate.usageNote,
          caution: candidate.caution,
          safetyLevel: candidate.safetyLevel,
          lifecycleStatus: "rising",
        },
      });
      const response = await fetch(exportUrl(pack.exportPath), {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`export_${response.status}`);

      const blob = await response.blob();
      const file = new File([blob], safeFilename(candidate.shortId), { type: "image/png" });
      const shareText = pack.shareText.replace(
        pack.detailPath,
        new URL(pack.detailPath, window.location.origin).toString(),
      );
      let canShareFiles = false;
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function") {
        try {
          canShareFiles = navigator.canShare({ files: [file] });
        } catch {
          canShareFiles = false;
        }
      }

      if (canShareFiles) {
        try {
          await navigator.share({
            title: candidate.title,
            text: shareText,
            files: [file],
          });
          setState("shared");
          return;
        } catch (error) {
          if (isShareCancelled(error)) {
            setState("idle");
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
      downloadCard(blob, safeFilename(candidate.shortId));
      setState(copied ? "fallback" : "downloaded");
    } catch {
      setState("error");
    }
  }

  const status =
    state === "shared"
      ? copy.shared
      : state === "fallback"
        ? copy.fallback
        : state === "downloaded"
          ? copy.downloaded
          : state === "error"
            ? copy.error
            : null;

  return (
    <div data-plus-daily-share="ready" className="border-t border-border px-4 py-3">
      <button
        type="button"
        onClick={() => void createSharePack()}
        disabled={state === "busy"}
        className="inline-flex min-h-10 items-center rounded-lg bg-accent-strong px-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {state === "busy" ? copy.sharing : copy.share}
      </button>
      {status && (
        <p role={state === "error" ? "alert" : "status"} className={`mt-2 text-xs leading-relaxed ${state === "error" ? "text-safety-red" : "text-muted"}`}>
          {status}
        </p>
      )}
    </div>
  );
}
