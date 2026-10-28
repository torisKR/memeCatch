import { SafetyIcon } from "@/components/safety-icon";
import type { Locale } from "@/lib/i18n";
import type { SafetyLevel } from "@/lib/labels";
import { getSafetySignalCopy } from "@/lib/safety-copy";

/** 색+모양+텍스트 병행 (색약 대응) */
const TONE: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

/**
 * 사용 안전 신호등 배지 (T1 시그니처).
 * 색 + 서로 다른 SVG 모양 + 텍스트 병행 — 색만으로 구분 금지.
 * 장식 글로우나 펄스 없이 정적인 상태로 표시한다.
 */
export function SafetyBadge({
  level,
  size = "sm",
  note,
  locale = "ko",
}: {
  level: SafetyLevel;
  size?: "sm" | "lg";
  /** lg 전용 짧은 사용 설명(usage_note 등). 없으면 미노출 */
  note?: string;
  locale?: Locale;
}) {
  const copy = getSafetySignalCopy(locale);
  const signal = copy.levels[level];
  if (size === "lg") {
    return (
      <p
        data-safety-signal={level}
        className={`flex min-h-14 items-center gap-3 rounded-xl px-5 py-3.5 ${TONE[level]}`}
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] text-2xl leading-none"
        >
          <SafetyIcon level={level} className="size-6" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium opacity-80">{copy.badgeTitle}</span>
          <span className="text-xl font-bold leading-tight">{signal.label}</span>
          {note && (
            <span className="mt-0.5 text-sm font-medium opacity-70">{note}</span>
          )}
        </span>
      </p>
    );
  }
  return (
    <span
      data-safety-signal={level}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${TONE[level]}`}
    >
      <span aria-hidden className="leading-none">
        <SafetyIcon level={level} className="size-4" />
      </span>
      {signal.label}
    </span>
  );
}
