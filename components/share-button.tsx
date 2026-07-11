"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * 공유 버튼 (Wave 1) — Web Share API 우선, 미지원 시 클립보드 복사.
 * 공유 링크에 utm_source=share&utm_medium={method} 부착 → GA4에서 공유발 세션 측정.
 */
export function ShareButton({
  path,
  title,
  label = "공유",
  className,
}: {
  /** 사이트 내부 경로 (예: /memes/abc-밈) */
  path: string;
  title: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const canNativeShare =
      typeof navigator !== "undefined" && !!navigator.share;
    const method = canNativeShare ? "native" : "link";
    const url = `${window.location.origin}${path}?utm_source=share&utm_medium=${method}`;
    track("share_click", { method, to: path });
    try {
      if (canNativeShare) {
        await navigator.share({ title: `${title} — 밈캐치`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 사용자가 공유 시트를 닫은 경우 등 — 무시 */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={
        className ??
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent active:scale-[0.97]"
      }
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="17" cy="6" r="2.5" />
        <circle cx="17" cy="18" r="2.5" />
        <path d="m8.3 10.8 6.4-3.6M8.3 13.2l6.4 3.6" />
      </svg>
      {copied ? "링크 복사됨!" : label}
    </button>
  );
}
