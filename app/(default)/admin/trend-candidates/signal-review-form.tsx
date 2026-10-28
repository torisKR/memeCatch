"use client";

import { useActionState } from "react";
import {
  reviewTrendCandidateSignal,
  type TrendCandidateActionResult,
} from "@/lib/actions/trend-candidates";

export function TrendCandidateSignalReviewForm({
  candidateId,
  signalId,
  currentRelationship,
}: {
  candidateId: string;
  signalId: string;
  currentRelationship: string;
}) {
  const [state, action, pending] = useActionState(
    async (_previous: TrendCandidateActionResult | null, formData: FormData) =>
      reviewTrendCandidateSignal({
        candidateId,
        signalId,
        relationship: String(formData.get("relationship") ?? "unknown"),
      }),
    null,
  );
  return (
    <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
      <select name="relationship" defaultValue={currentRelationship} className="min-h-11 rounded-lg border border-border bg-background px-2 text-sm">
        <option value="unknown">판단 대기</option>
        <option value="independent">독립 사용례</option>
        <option value="repost">동일 영상 재업로드</option>
        <option value="crosspost">동일 작성자 크로스포스팅</option>
        <option value="citation">같은 원문 인용·재전재</option>
      </select>
      <button type="submit" disabled={pending} className="min-h-11 rounded-full border border-border px-3 text-sm font-semibold disabled:opacity-50">관계 저장</button>
      {state ? <span role={state.ok ? "status" : "alert"} className={state.ok ? "text-xs text-accent" : "text-xs text-danger"}>{state.ok ? state.message : state.error}</span> : null}
    </form>
  );
}
