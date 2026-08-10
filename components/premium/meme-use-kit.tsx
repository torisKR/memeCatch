"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/lib/i18n-client";
import { localizedStaticPath } from "@/lib/i18n-routing";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { usePremium } from "@/lib/hooks/use-premium";
import { track } from "@/lib/analytics";
import type { Locale } from "@/lib/i18n";
import {
  buildMemeUseKit,
  type MemeUseKitFacts,
} from "@/lib/meme-use-kit";

export function MemeUseKitEntry({ locale }: { locale: Locale }) {
  const copy = PREMIUM_COPY[locale].kit;

  return (
    <Link
      href="#meme-use-kit-title"
      data-meme-use-kit-entry="available"
      className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      {copy.open}
      <span aria-hidden className="ml-2">↓</span>
    </Link>
  );
}

export function MemeUseKit(facts: MemeUseKitFacts) {
  const isPremium = usePremium();
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale].kit;
  const items = buildMemeUseKit(facts, copy);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [prepared, setPrepared] = useState(false);

  async function copyText(id: string, text: string) {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setPrepared(true);
      track("use_kit_copied", { format: id });
    } catch {
      setCopied(null);
      setCopyFailed(true);
    }
  }

  if (!isPremium) {
    return (
      <section
        aria-labelledby="meme-use-kit-title"
        data-premium-kit="locked"
        className="rounded-2xl border border-accent/30 bg-accent-soft/30 p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
              {copy.eyebrow}
            </p>
            <h2 id="meme-use-kit-title" className="mt-1 text-lg font-bold">
              {copy.title}
            </h2>
          </div>
          <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-black tracking-wider text-accent-text">
            {copy.plusBadge}
          </span>
        </div>
        <div className="mt-4 rounded-xl border border-border bg-surface p-4">
          <h3 className="font-bold">{copy.lockedTitle}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{copy.lockedBody}</p>
          <Link
            href={localizedStaticPath("/pricing", locale)}
            className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            {copy.upgrade}
          </Link>
        </div>
      </section>
    );
  }

  const allText = items.map((item) => `${item.title}\n${item.body}`).join("\n\n");

  async function shareAll() {
    setCopyFailed(false);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: facts.title, text: allText });
        setCopied("shared");
        setPrepared(true);
        track("use_kit_copied", { format: "share" });
        return;
      }

      await navigator.clipboard.writeText(allText);
      setCopied("all");
      setPrepared(true);
      track("use_kit_copied", { format: "share_fallback" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setCopied(null);
      setCopyFailed(true);
    }
  }

  return (
    <section
      aria-labelledby="meme-use-kit-title"
      data-premium-kit="active"
      className="rounded-2xl border border-accent/30 bg-accent-soft/20 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent-text">
            {copy.eyebrow}
          </p>
          <h2 id="meme-use-kit-title" className="mt-1 text-lg font-bold">
            {copy.title}
          </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyText("all", allText)}
            className="inline-flex min-h-11 items-center rounded-xl border border-accent/40 bg-surface px-3 text-sm font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {copied === "all" ? copy.copied : copy.copyAll}
          </button>
          <button
            type="button"
            onClick={() => void shareAll()}
            data-meme-use-kit-share
            className="inline-flex min-h-11 items-center rounded-xl border border-accent/40 bg-surface px-3 text-sm font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {copied === "shared" ? copy.shared : copy.shareAll}
          </button>
        </div>
      </div>

      {prepared && (
        <p className="mt-4 rounded-xl bg-surface px-3 py-2 text-sm font-semibold text-accent-text" role="status" data-plus-use-kit-state="prepared">
          {copy.prepared}
        </p>
      )}

      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold">{item.title}</h3>
              <button
                type="button"
                onClick={() => void copyText(item.id, item.body)}
                className="inline-flex min-h-10 shrink-0 items-center rounded-lg border border-border px-3 text-xs font-bold text-accent-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {copied === item.id ? copy.copied : copy.copy}
              </button>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-foreground">{item.body}</p>
          </article>
        ))}
      </div>

      {copyFailed && (
        <p role="alert" className="mt-3 text-sm text-safety-red">
          {copy.copyFailed}
        </p>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted">{copy.sourceNote}</p>
    </section>
  );
}
