import { SUBMISSION_STATUS } from "@/lib/labels";

type SubmissionStatusKey = keyof typeof SUBMISSION_STATUS;

/**
 * 제보 상태 배지 — labels.ts SUBMISSION_STATUS 단일 소스.
 * globals.css에 sub-* 토큰이 아직 없어 기존 신호등 토큰 쌍으로 매핑 (하드코딩 색 금지 원칙 준수).
 */
const STATUS_CLASSES: Record<SubmissionStatusKey, string> = {
  pending: "bg-safety-gray-bg text-safety-gray",
  reviewing: "bg-safety-yellow-bg text-safety-yellow",
  approved: "bg-safety-green-bg text-safety-green",
  rejected: "bg-safety-red-bg text-safety-red",
};

/** 배지 미세 네온 — 신호등 색 그대로, 정적 box-shadow(모션 없음)만 추가 */
const STATUS_GLOW: Record<SubmissionStatusKey, string> = {
  pending:
    "shadow-[0_0_0_1px_color-mix(in_srgb,var(--safety-gray)_30%,transparent),0_0_10px_-4px_color-mix(in_srgb,var(--safety-gray)_50%,transparent)]",
  reviewing:
    "shadow-[0_0_0_1px_color-mix(in_srgb,var(--safety-yellow)_30%,transparent),0_0_10px_-4px_color-mix(in_srgb,var(--safety-yellow)_50%,transparent)]",
  approved:
    "shadow-[0_0_0_1px_color-mix(in_srgb,var(--safety-green)_30%,transparent),0_0_10px_-4px_color-mix(in_srgb,var(--safety-green)_50%,transparent)]",
  rejected:
    "shadow-[0_0_0_1px_color-mix(in_srgb,var(--safety-red)_30%,transparent),0_0_10px_-4px_color-mix(in_srgb,var(--safety-red)_50%,transparent)]",
};

/** 상태별 짧은 라벨 (배지용) — pending의 긴 안내문은 별도 본문에서 사용 */
const SHORT_LABELS: Record<SubmissionStatusKey, string> = {
  pending: "접수됨",
  reviewing: SUBMISSION_STATUS.reviewing.user,
  approved: SUBMISSION_STATUS.approved.user,
  rejected: SUBMISSION_STATUS.rejected.user,
};

export function SubmissionStatusBadge({
  status,
  className = "",
  label,
}: {
  status: SubmissionStatusKey;
  className?: string;
  /** Localized override for contexts that already own the user-facing copy. */
  label?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${STATUS_CLASSES[status]} ${STATUS_GLOW[status]} ${className}`}
    >
      {label ?? SHORT_LABELS[status]}
    </span>
  );
}
