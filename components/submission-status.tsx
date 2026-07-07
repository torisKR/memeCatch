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
}: {
  status: SubmissionStatusKey;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${STATUS_CLASSES[status]} ${className}`}
    >
      {SHORT_LABELS[status]}
    </span>
  );
}
