"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { usePremium } from "@/lib/hooks/use-premium";
import type { Locale } from "@/lib/i18n";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { localizedStaticPath, type SeoContentLocale } from "@/lib/i18n-routing";
import { createClient } from "@/lib/supabase/client";

type RequestStatus =
  | "none"
  | "requested"
  | "in_review"
  | "completed"
  | "dismissed"
  | "already_available"
  | "unavailable";

function isRequestStatus(value: unknown): value is RequestStatus {
  return [
    "none",
    "requested",
    "in_review",
    "completed",
    "dismissed",
    "already_available",
    "unavailable",
  ].includes(value as RequestStatus);
}

export function TranslationPriorityStatusMessage({
  status,
  copy,
  requestDeskHref,
}: {
  status: RequestStatus;
  copy: { requested: string; inReview: string; track: string };
  requestDeskHref: string;
}) {
  if (status !== "requested" && status !== "in_review") return null;
  const message = status === "in_review" ? copy.inReview : copy.requested;

  return (
    <>
      <p className="mt-4 rounded-xl bg-surface px-3 py-2 text-sm font-semibold" role="status">
        {message}
      </p>
      <Link
        href={requestDeskHref}
        data-translation-priority-track
        className="mt-3 inline-flex min-h-10 items-center rounded-xl font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {copy.track}
        <span aria-hidden> →</span>
      </Link>
    </>
  );
}

export function TranslationPriorityButton({
  memeId,
  locale,
  translationStatus,
  translationIsCurrent,
}: {
  memeId: string;
  locale: SeoContentLocale;
  translationStatus: string;
  translationIsCurrent: boolean;
}) {
  const isPremium = usePremium();
  const copy = PREMIUM_COPY[locale as Locale].translationPriority;
  const requestDeskHref = `${localizedStaticPath("/premium", locale)}#plus-translation-fulfillment-title`;
  const [saved, setSaved] = useState<boolean | null>(null);
  const [status, setStatus] = useState<RequestStatus>("none");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const readyTracked = useRef(false);
  const needsReview = !(translationStatus === "reviewed" && translationIsCurrent);

  useEffect(() => {
    if (!needsReview || !isPremium) return;
    let cancelled = false;
    const supabase = createClient();

    async function refreshState() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setSaved(false);
        return;
      }
      const [{ data: savedRow }, response] = await Promise.all([
        supabase.from("saved_memes").select("meme_id").eq("meme_id", memeId).maybeSingle(),
        fetch(`/api/translation-priority?memeId=${encodeURIComponent(memeId)}&locale=${locale}`, {
          cache: "no-store",
        }),
      ]);
      if (cancelled) return;
      setSaved(Boolean(savedRow));
      if (!response.ok) return;
      const payload = (await response.json().catch(() => null)) as { status?: unknown } | null;
      if (payload && isRequestStatus(payload.status)) {
        setStatus(payload.status === "completed" && !translationIsCurrent ? "none" : payload.status);
      }
    }

    void refreshState();
    const onSave = () => void refreshState();
    window.addEventListener("memecatch:save", onSave);
    return () => {
      cancelled = true;
      window.removeEventListener("memecatch:save", onSave);
    };
  }, [isPremium, locale, memeId, needsReview, translationIsCurrent]);

  useEffect(() => {
    if (status !== "completed" || readyTracked.current) return;
    readyTracked.current = true;
    track("translation_ready_opened", { locale });
  }, [locale, status]);

  if (!needsReview) {
    return (
      <section className="rounded-2xl border border-safety-green/30 bg-safety-green-bg/40 p-5" data-translation-priority-state="available">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-safety-green">{copy.eyebrow}</p>
        <p className="mt-2 text-sm font-semibold text-safety-green">{copy.alreadyAvailable}</p>
      </section>
    );
  }

  async function requestReview() {
    if (busy || saved !== true) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/translation-priority", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memeId, locale }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; status?: unknown } | null;
      if (!response.ok) {
        setMessage(payload?.error === "save_required" ? copy.saveRequired : copy.retry);
        return;
      }
      if (!isRequestStatus(payload?.status)) {
        setStatus("unavailable");
        setMessage(copy.retry);
        return;
      }
      const nextStatus = payload.status;
      setStatus(nextStatus);
      track("translation_priority_requested", { locale, result: nextStatus });
      setMessage(nextStatus === "already_available" ? copy.alreadyAvailable : copy.requested);
    } catch {
      setMessage(copy.retry);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="translation-priority-title"
      data-translation-priority-state={status}
      className="rounded-2xl border border-accent/30 bg-accent-soft/20 p-5"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">{copy.eyebrow}</p>
      <h2 id="translation-priority-title" className="mt-1 text-lg font-bold">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{copy.body}</p>
      {!isPremium ? (
        <Link
          href={localizedStaticPath("/pricing", locale)}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white"
        >
          {copy.upgrade}
        </Link>
      ) : status === "completed" ? (
        <p className="mt-4 rounded-xl bg-safety-green-bg px-3 py-2 text-sm font-semibold text-safety-green" role="status">{copy.completed}</p>
      ) : status === "in_review" || status === "requested" ? (
        <TranslationPriorityStatusMessage
          status={status}
          copy={copy}
          requestDeskHref={requestDeskHref}
        />
      ) : saved === false ? (
        <p className="mt-4 rounded-xl bg-surface px-3 py-2 text-sm text-muted" role="status">{copy.saveRequired}</p>
      ) : (
        <button
          type="button"
          onClick={() => void requestReview()}
          disabled={busy || saved !== true || status === "unavailable"}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? copy.requesting : copy.request}
        </button>
      )}
      {message && <p className="mt-2 text-sm font-semibold text-accent-text" role="status">{message}</p>}
    </section>
  );
}
