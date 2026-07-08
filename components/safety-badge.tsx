import { SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";

/** 색+아이콘+텍스트 병행 (색약 대응) — 문구·아이콘은 labels.ts가 단일 소스 */
const TONE: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

/**
 * 사용 안전 신호등 배지 (T1 시그니처).
 * 색 원 + 아이콘(●▲◌✕) + 텍스트 병행 — 색만으로 구분 금지.
 * 마운트 시 해당 신호등 색으로 글로우 펄스 1회(.safety-pulse, currentColor 기반).
 * reduced-motion은 globals.css에서 무효화.
 */
export function SafetyBadge({
  level,
  size = "sm",
  note,
}: {
  level: SafetyLevel;
  size?: "sm" | "lg";
  /** lg 전용 짧은 사용 설명(usage_note 등). 없으면 미노출 */
  note?: string;
}) {
  const s = SAFETY_LEVELS[level];
  if (size === "lg") {
    return (
      <p
        className={`safety-pulse flex min-h-14 items-center gap-3 rounded-2xl px-5 py-3.5 ${TONE[level]}`}
      >
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] text-2xl leading-none"
        >
          {s.icon}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium opacity-80">사용 안전 신호등</span>
          <span className="text-xl font-bold leading-tight">{s.user}</span>
          {note && (
            <span className="mt-0.5 text-sm font-medium opacity-70">{note}</span>
          )}
        </span>
      </p>
    );
  }
  return (
    <span
      className={`safety-pulse inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${TONE[level]}`}
    >
      <span aria-hidden className="leading-none">
        {s.icon}
      </span>
      {s.user}
    </span>
  );
}
