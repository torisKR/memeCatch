/**
 * 관리자 콘솔 표시용 배지 — labels.ts 토큰만 사용 (색+아이콘+텍스트 병행).
 * 서버 컴포넌트에서도 사용 가능한 순수 컴포넌트.
 */

import { SAFETY_LEVELS, MODERATION_STATUS, ORIGIN_KIND, type SafetyLevel } from "@/lib/labels";
import { isHouseOriginal } from "@/lib/house-original";
import type { ModerationStatus } from "./constants";

export function SafetyBadge({ level }: { level: SafetyLevel }) {
  const s = SAFETY_LEVELS[level];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium"
      style={{
        color: `var(--safety-${level})`,
        background: `var(--safety-${level}-bg)`,
      }}
    >
      <span aria-hidden>{s.icon}</span>
      {s.admin}
    </span>
  );
}

const MOD_STYLE: Record<ModerationStatus, string> = {
  pending: "text-muted bg-surface-2",
  fact_checking: "text-safety-yellow bg-safety-yellow-bg",
  rights_checking: "text-safety-yellow bg-safety-yellow-bg",
  approved: "text-safety-green bg-safety-green-bg",
  limited: "text-safety-gray bg-safety-gray-bg",
  rejected: "text-safety-red bg-safety-red-bg",
};

export function ModerationBadge({ status }: { status: ModerationStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium ${MOD_STYLE[status]}`}
    >
      {MODERATION_STATUS[status].admin}
    </span>
  );
}

export function OverdueBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-safety-red-bg px-2.5 py-0.5 text-sm font-semibold text-safety-red">
      <span aria-hidden>▲</span>48시간 초과
    </span>
  );
}

export function OriginKindBadge({ originKind }: { originKind: string | null | undefined }) {
  if (!isHouseOriginal(originKind)) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-medium text-foreground">
      {ORIGIN_KIND.house_original.admin}
    </span>
  );
}
