import { LIFECYCLE_STATUS, type LifecycleStatus } from "@/lib/labels";

/** 밈 생명 게이지 (T4 시그니처) — 4칸 불꽃 미터, 색+개수+텍스트 병행 */
const TONE: Record<LifecycleStatus, string> = {
  rising: "text-life-rising",
  active: "text-life-active",
  cooling: "text-life-cooling",
  archived: "text-life-archived",
};
/* 라벨 텍스트는 밝은 표면 위 AA(4.5:1) 진한 변형 — 불꽃 아이콘만 원색 유지 */
const LABEL_TONE: Record<LifecycleStatus, string> = {
  rising: "text-life-rising-text",
  active: "text-life-active-text",
  cooling: "text-life-cooling-text",
  archived: "text-life-archived-text",
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
  const isRising = status === "rising";
  const topLit = meta.flame - 1; // 최상단(선두) 불꽃 인덱스

  return (
    <span
      role="img"
      aria-label={`밈 생명 게이지: ${meta.user} (4칸 중 ${meta.flame}칸)`}
      className={`inline-flex items-center gap-1.5 ${TONE[status]}`}
    >
      <span aria-hidden className="inline-flex items-end gap-0.5">
        {[0, 1, 2, 3].map((i) => {
          const lit = i < meta.flame;
          const rising = lit && isRising;
          // 선두 불꽃이 먼저, 아래로 갈수록 지연 — 물결처럼 타오르게
          const flicker = rising
            ? `flame-rising${i === topLit ? " flame-rising-tip" : ""}`
            : "";
          return (
            <FlameIcon
              key={i}
              lit={lit}
              className={`${flameSize} ${flicker} ${lit ? "" : "opacity-25"}`}
              style={rising ? { animationDelay: `${(topLit - i) * 130}ms` } : undefined}
            />
          );
        })}
      </span>
      {showLabel && (
        <span
          className={`font-semibold ${LABEL_TONE[status]} ${size === "lg" ? "text-base" : "text-sm"}`}
        >
          {meta.user}
        </span>
      )}
    </span>
  );
}

function FlameIcon({
  lit,
  className,
  style,
}: {
  lit: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
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
