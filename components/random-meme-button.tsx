"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";

/** 헤더 🎲 — 랜덤 밈 이동 (Wave 1). 주사위 SVG(이모지 금지 규칙 준수) */
export function RandomMemeButton() {
  return (
    <Link
      href="/memes/random"
      prefetch={false}
      aria-label="아무 밈이나 보기"
      title="아무 밈이나 보기"
      onClick={() => track("random_meme")}
      className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-2 active:scale-[0.95]"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <circle cx="8.6" cy="8.6" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="15.4" cy="8.6" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="8.6" cy="15.4" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="15.4" cy="15.4" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    </Link>
  );
}
