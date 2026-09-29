import type { ReactNode } from "react";

import type { SafetyLevel } from "@/lib/labels";

const SYMBOLS: Record<SafetyLevel, ReactNode> = {
  green: (
    <>
      <path d="M4.75 12.35 9.2 16.8 19.25 6.75" />
      <path d="M12 2.75a9.25 9.25 0 1 1-6.54 2.71" opacity=".32" />
    </>
  ),
  yellow: (
    <>
      <path d="M5.25 4.25h13.5a2 2 0 0 1 2 2v8.25a2 2 0 0 1-2 2H10l-4.75 3v-3a2 2 0 0 1-2-2V6.25a2 2 0 0 1 2-2Z" />
      <path d="M12 7.4v4.15M12 14.1h.01" />
    </>
  ),
  gray: (
    <>
      <path d="M12 3.25a8.75 8.75 0 1 1-8.75 8.75A8.75 8.75 0 0 1 12 3.25Z" />
      <path d="M12 7.1v5.25l3.35 2.05M3.3 5.35h3.15M2.25 8h2.1" />
    </>
  ),
  red: (
    <>
      <path d="m8.35 2.75-5.6 5.6v7.3l5.6 5.6h7.3l5.6-5.6v-7.3l-5.6-5.6h-7.3Z" />
      <path d="M7.25 12h9.5" />
    </>
  ),
};

export function SafetyIcon({
  level,
  className,
  title,
}: {
  level: SafetyLevel;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.85"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      className={className ?? "size-5"}
      data-safety-icon={level}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      role={title ? "img" : undefined}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {SYMBOLS[level]}
    </svg>
  );
}
