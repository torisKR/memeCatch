import type { Metadata } from "next";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { RadarSafetyReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Radar 안전 검수" };
export const dynamic = "force-dynamic";

type SafetyLevel = "green" | "yellow" | "gray" | "red";

type SafetyReviewRow = {
  id: string;
  proposed_level: SafetyLevel;
  reason: string;
  evidence: unknown;
  requested_at: string;
  memes: {
    title: string;
    safety_level: SafetyLevel;
  } | null;
};

const LEVEL_LABEL: Record<SafetyLevel, string> = {
  green: "안전",
  yellow: "주의",
  gray: "판단 보류",
  red: "위험",
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Seoul",
});

function formatEvidence(evidence: unknown): string {
  if (typeof evidence === "string") return evidence;
  try {
    return JSON.stringify(evidence, null, 2);
  } catch {
    return "증거 데이터를 표시할 수 없어요.";
  }
}

export default async function AdminRadarSafetyPage() {
  const { supabase } = await requireOperatorPage("/admin/radar-safety");
  const { data, error } = await supabase
    .from("safety_review_queue")
    .select("id, proposed_level, reason, evidence, requested_at, memes(title, safety_level)")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(100);
  const rows = (data ?? []) as SafetyReviewRow[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Radar 안전 검수</h1>
        <p className="mt-1 text-sm text-muted">
          외부 신호는 변경 제안만 등록합니다. 안전 등급은 운영자가 이 화면에서 검수한
          경우에만 반영됩니다.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-danger p-4 text-sm text-danger">
          대기 중인 안전 검수 요청을 불러오지 못했어요.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
          대기 중인 안전 검수 요청이 없어요.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-foreground">
                    {row.memes?.title ?? "삭제되었거나 찾을 수 없는 밈"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    현재 <strong>{row.memes ? LEVEL_LABEL[row.memes.safety_level] : "확인 불가"}</strong>
                    {" → "}
                    제안 <strong className="text-foreground">{LEVEL_LABEL[row.proposed_level]}</strong>
                  </p>
                </div>
                <time dateTime={row.requested_at} className="text-xs text-muted">
                  {dateFormatter.format(new Date(row.requested_at))}
                </time>
              </div>
              <section className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">제안 사유</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{row.reason}</p>
              </section>
              <section className="mt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">증거</h3>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded-xl bg-background p-3 text-xs text-muted">
                  {formatEvidence(row.evidence)}
                </pre>
              </section>
              <RadarSafetyReviewForm reviewId={row.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
