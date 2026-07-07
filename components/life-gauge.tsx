import { LIFECYCLE_STATUS, type LifecycleStatus } from "@/lib/labels";

/** 밈 생명 게이지 (T4 시그니처) — 4칸 불꽃 미터, 색+개수+텍스트 병행 */
const TONE: Record<LifecycleStatus, string> = {
  rising: "text-life-rising",
  active: "text-life-active",
  cooling: "text-life-cooling",
  archived: "text-life-archived",
};

export function LifeGauge({
  status,
  size = "sm",
  showLabel = true,
}: {
  status: LifecycleStatus;
  size?: "sm" | "lg";
  showLabel?: boolean;
}) {
  const meta = LIFECYCLE_STATUS[status];
  const flameSize = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  return (
    <span
      role="img"
      aria-label={`밈 생명 게이지: ${meta.user} (4칸 중 ${meta.flame}칸)`}
      className={`inline-flex items-center gap-1.5 ${TONE[status]}`}
    >
      <span aria-hidden className="inline-flex items-end gap-0.5">
        {[0, 1, 2, 3].map((i) => {
          const lit = i < meta.flame;
          return (
            <FlameIcon
              key={i}
              lit={lit}
              className={`${flameSize} ${lit && status === "rising" ? "flame-rising" : ""} ${lit ? "" : "opacity-25"}`}
            />
          );
        })}
      </span>
      {showLabel && (
        <span
          className={`font-semibold ${size === "lg" ? "text-base" : "text-sm"}`}
        >
          {meta.user}
        </span>
      )}
    </span>
  );
}

function FlameIcon({ lit, className }: { lit: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={lit ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.5c.6 3.2-1.8 4.9-1.8 7.4a2.6 2.6 0 0 0 5.2.3c1.7 1.6 2.6 3.4 2.6 5.3a6 6 0 1 1-12 0c0-2.6 1.3-4.5 3-6.2.3 1.4.9 2.3 1.7 2.8-.4-3.3.1-6.4 1.3-9.6Z" />
    </svg>
  );
}
