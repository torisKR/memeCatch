import { SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";

/** 색+아이콘+텍스트 병행 (색약 대응) — 문구·아이콘은 labels.ts가 단일 소스 */
const TONE: Record<SafetyLevel, string> = {
  green: "bg-safety-green-bg text-safety-green",
  yellow: "bg-safety-yellow-bg text-safety-yellow",
  gray: "bg-safety-gray-bg text-safety-gray",
  red: "bg-safety-red-bg text-safety-red",
};

export function SafetyBadge({
  level,
  size = "sm",
}: {
  level: SafetyLevel;
  size?: "sm" | "lg";
}) {
  const s = SAFETY_LEVELS[level];
  if (size === "lg") {
    return (
      <p
        className={`flex min-h-14 items-center gap-3 rounded-2xl px-5 py-3.5 ${TONE[level]}`}
      >
        <span aria-hidden className="text-2xl leading-none">
          {s.icon}
        </span>
        <span className="flex flex-col">
          <span className="text-sm font-medium opacity-80">사용 안전 신호등</span>
          <span className="text-xl font-bold leading-tight">{s.user}</span>
        </span>
      </p>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${TONE[level]}`}
    >
      <span aria-hidden className="leading-none">
        {s.icon}
      </span>
      {s.user}
    </span>
  );
}
