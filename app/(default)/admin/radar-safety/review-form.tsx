"use client";

import { useActionState } from "react";
import {
  applyRadarSafetyReview,
  type RadarSafetyActionResult,
} from "@/lib/actions/radar-safety";

const initialState: RadarSafetyActionResult | null = null;

export function RadarSafetyReviewForm({ reviewId }: { reviewId: string }) {
  const [state, formAction, pending] = useActionState(
    async (_previous: RadarSafetyActionResult | null, formData: FormData) =>
      applyRadarSafetyReview({
        reviewId,
        decision: formData.get("decision") === "approved" ? "approved" : "rejected",
        reviewNote: String(formData.get("reviewNote") ?? ""),
      }),
    initialState,
  );

  return (
    <form action={formAction} className="mt-4 space-y-3 border-t border-border pt-4">
      <label className="block text-sm font-medium text-foreground">
        검수 메모
        <textarea
          name="reviewNote"
          required
          maxLength={2000}
          rows={3}
          placeholder="판단 근거와 확인한 내용을 남겨 주세요."
          className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          name="decision"
          value="approved"
          disabled={pending}
          className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          등급 변경 승인
        </button>
        <button
          type="submit"
          name="decision"
          value="rejected"
          disabled={pending}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
        >
          제안 반려
        </button>
        {pending && <span className="text-xs text-muted">처리 중…</span>}
      </div>
      {state && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`text-sm ${state.ok ? "text-accent" : "text-danger"}`}
        >
          {state.ok ? "검수 결과를 반영했어요." : state.error}
        </p>
      )}
    </form>
  );
}
