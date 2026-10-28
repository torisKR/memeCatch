"use client";

import { useActionState } from "react";

import {
  recordPublisherReadinessReview,
  type PublisherReadinessReviewActionResult,
} from "@/lib/actions/publisher-readiness";

const initialState: PublisherReadinessReviewActionResult | null = null;

const CHECKLIST = [
  ["meaningContext", "뜻·사용 맥락이 실제 화면과 일치함"],
  ["sourceClaims", "유래·날짜·사실 주장을 원자료와 대조함"],
  ["rightsDelivery", "링크·공식 임베드·자체 제작 등 전달 근거를 확인함"],
  ["safetyContext", "사용 주의와 안전 수준을 현재 문맥으로 확인함"],
  ["ownHumanValue", "출처 복사가 아닌 밈캐치의 고유 해설 가치가 있음"],
] as const;

export function PublisherReadinessReviewForm({
  memeId,
  expectedFingerprint,
}: {
  memeId: string;
  expectedFingerprint: string;
}) {
  const [state, formAction, pending] = useActionState(
    async (_previous: PublisherReadinessReviewActionResult | null, formData: FormData) =>
      recordPublisherReadinessReview({
        memeId,
        expectedFingerprint: String(formData.get("expectedFingerprint") ?? ""),
        checklist: {
          meaningContext: formData.get("meaningContext") === "on",
          sourceClaims: formData.get("sourceClaims") === "on",
          rightsDelivery: formData.get("rightsDelivery") === "on",
          safetyContext: formData.get("safetyContext") === "on",
          ownHumanValue: formData.get("ownHumanValue") === "on",
        },
        note: String(formData.get("note") ?? ""),
      }),
    initialState,
  );

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-border pt-3">
      <input type="hidden" name="expectedFingerprint" value={expectedFingerprint} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">사람 검수 체크리스트</legend>
        {CHECKLIST.map(([name, label]) => (
          <label key={name} className="flex items-start gap-2 text-sm leading-relaxed">
            <input type="checkbox" name={name} required className="mt-1 size-4" />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <label className="block text-sm font-medium">
        검수 근거
        <textarea
          name="note"
          required
          minLength={10}
          maxLength={2000}
          rows={3}
          placeholder="확인한 원자료와 판단 근거를 남겨 주세요. 개인정보는 쓰지 마세요."
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "기록 중…" : "현재 지문으로 검수 기록"}
        </button>
        {state ? (
          <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-accent-text" : "text-sm text-danger"}>
            {state.ok ? "검수 기록을 저장했어요." : state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
