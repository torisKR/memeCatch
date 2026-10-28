"use client";

import { useActionState } from "react";
import {
  reviewTrendCandidate,
  type TrendCandidateActionResult,
} from "@/lib/actions/trend-candidates";

export function TrendCandidateReviewForm({
  candidateId,
  evidenceLinks = [],
  signals = [],
}: {
  candidateId: string;
  evidenceLinks?: Array<{ label: string; url: string }>;
  signals?: Array<{ id: string; label: string }>;
}) {
  const [state, action, pending] = useActionState(
    async (_previous: TrendCandidateActionResult | null, formData: FormData) =>
      reviewTrendCandidate({
        candidateId,
        decision: String(formData.get("decision") ?? "hold"),
        note: String(formData.get("note") ?? ""),
        publicSummary: String(formData.get("publicSummary") ?? ""),
        evidenceScope: String(formData.get("evidenceScope") ?? ""),
        evidenceLinks: String(formData.get("evidenceLinks") ?? ""),
        targetMemeId: String(formData.get("targetMemeId") ?? ""),
        targetCandidateId: String(formData.get("targetCandidateId") ?? ""),
        splitSignalIds: formData.getAll("splitSignalIds").map(String).join(","),
      }),
    null,
  );

  return (
    <form action={action} className="mt-5 space-y-3 border-t border-border pt-5">
      <label className="block text-sm font-medium">
        공개 설명
        <textarea name="publicSummary" rows={3} maxLength={2000} placeholder="실제 관찰값으로 ‘왜 지금 뜨는지’를 적어 주세요." className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        조사 범위
        <input name="evidenceScope" maxLength={500} placeholder="예: TikTok 공개 URL 제보 5건, 10월 6~12일" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        공개 근거 링크
        <textarea name="evidenceLinks" rows={3} maxLength={5000} defaultValue={evidenceLinks.map((link) => `${link.label} | ${link.url}`).join("\n")} placeholder={"사용례 1 | https://…\n사용례 2 | https://…"} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" />
        <span className="mt-1 block text-xs font-normal text-muted">검수된 독립 사용례 URL만 미리 채웁니다. 승인 시 3개 이상 필요합니다.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          기존 밈 UUID
          <input name="targetMemeId" placeholder="기존 밈 연결·별칭 처리 대상" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" />
        </label>
        <label className="block text-sm font-medium">
          대상 후보 UUID
          <input name="targetCandidateId" placeholder="병합·분리 대상" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" />
        </label>
      </div>
      {signals.length > 0 ? (
        <fieldset className="rounded-xl border border-border p-3">
          <legend className="px-1 text-sm font-medium">분리할 사용례</legend>
          <p className="mb-2 text-xs text-muted">분리 결정에 포함할 사용례를 명시적으로 선택해 주세요.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {signals.map((signal) => (
              <label key={signal.id} className="flex min-h-11 items-center gap-2 text-xs">
                <input type="checkbox" name="splitSignalIds" value={signal.id} />
                <span className="min-w-0 break-all">{signal.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="block text-sm font-medium">
        검수 메모
        <textarea name="note" required rows={3} maxLength={2000} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="approve" disabled={pending} className="rounded-full bg-accent-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">승인·공개</button>
        <button type="submit" name="decision" value="changes_requested" disabled={pending} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">수정 요청</button>
        <button type="submit" name="decision" value="hold" disabled={pending} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">보류</button>
        <button type="submit" name="decision" value="reject" disabled={pending} className="rounded-full border border-danger px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50">거절</button>
        <button type="submit" name="decision" value="link_existing" disabled={pending} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">기존 밈 연결</button>
        <button type="submit" name="decision" value="link_alias" disabled={pending} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">별칭으로 연결</button>
        <button type="submit" name="decision" value="merge" disabled={pending} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">병합</button>
        <button type="submit" name="decision" value="split" disabled={pending} className="rounded-full border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50">분리</button>
      </div>
      {pending ? <p className="text-xs text-muted">처리 중…</p> : null}
      {state ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm text-accent" : "text-sm text-danger"}>{state.ok ? state.message : state.error}</p> : null}
    </form>
  );
}
