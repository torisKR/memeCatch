"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type CopyTextButtonProps = {
  text: string;
  label?: string;
  copiedLabel?: string;
  ariaLabel?: string;
  variant?: "ghost" | "pill" | "outline" | "mini";
  className?: string;
};

export function CopyTextButton({
  text,
  label,
  copiedLabel = "복사됨!",
  ariaLabel = "텍스트 복사",
  variant = "mini",
  className = "",
}: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(15);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 접근 불가 시 무시
    }
  }

  const baseClasses =
    "inline-flex items-center justify-center font-medium transition-all active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

  let variantClasses = "min-h-[32px] px-2.5 py-1 text-xs rounded-lg border border-border bg-surface-2 text-muted hover:text-foreground hover:border-accent/40";

  if (variant === "ghost") {
    variantClasses = "min-h-[32px] p-1.5 text-xs rounded-lg text-muted hover:text-foreground hover:bg-surface-2";
  } else if (variant === "pill") {
    variantClasses = "min-h-[36px] px-3 py-1.5 text-xs rounded-full border border-border bg-surface text-foreground shadow-xs hover:border-accent/50 hover:bg-accent/5";
  } else if (variant === "outline") {
    variantClasses = "min-h-[40px] px-3.5 py-2 text-sm rounded-xl border border-border bg-surface text-foreground hover:border-accent hover:text-accent shadow-xs";
  } else if (variant === "mini") {
    variantClasses = "h-7 px-2 text-[11px] rounded-md border border-border/80 bg-surface text-muted hover:text-foreground hover:border-accent/50";
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`${baseClasses} ${variantClasses} ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 shrink-0 text-safety-green" />
          <span className="ml-1 font-semibold text-safety-green">
            {copiedLabel}
          </span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5 shrink-0 opacity-70" />
          {label && <span className="ml-1">{label}</span>}
        </>
      )}
    </button>
  );
}
