"use client";

import { useActionState } from "react";
import {
  configureTrendDiscoverySeed,
  submitTrendCandidateEvidence,
  type TrendCandidateEntryActionResult,
} from "@/lib/actions/trend-candidate-entry";

export function TrendCandidateEntryPanel() {
  const [entryState, entryAction, entryPending] = useActionState(
    async (_previous: TrendCandidateEntryActionResult | null, formData: FormData) =>
      submitTrendCandidateEvidence({
        candidateName: String(formData.get("candidateName") ?? ""),
        aliases: String(formData.get("aliases") ?? ""),
        candidateKind: String(formData.get("candidateKind") ?? "new_meme"),
        targetMemeId: String(formData.get("targetMemeId") ?? ""),
        sourceUrl: String(formData.get("sourceUrl") ?? ""),
        platform: String(formData.get("platform") ?? ""),
        platformContentId: String(formData.get("platformContentId") ?? ""),
        creatorKey: String(formData.get("creatorKey") ?? ""),
        publishedAt: String(formData.get("publishedAt") ?? ""),
        note: String(formData.get("note") ?? ""),
      }),
    null,
  );
  const [seedState, seedAction, seedPending] = useActionState(
    async (_previous: TrendCandidateEntryActionResult | null, formData: FormData) =>
      configureTrendDiscoverySeed({
        seedType: String(formData.get("seedType") ?? "term"),
        seedValue: String(formData.get("seedValue") ?? ""),
        lane: String(formData.get("lane") ?? "new_discovery"),
        platform: String(formData.get("seedPlatform") ?? ""),
        enabled: formData.get("enabled") === "on",
        callBudget: Number(formData.get("callBudget") ?? 0),
      }),
    null,
  );

  return (
    <section aria-labelledby="manual-trend-entry-title" className="grid gap-5 lg:grid-cols-2">
      <form action={entryAction} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <div>
          <h2 id="manual-trend-entry-title" className="text-lg font-bold">원문 URL로 후보 등록</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">실제로 확인한 공개 원문만 등록합니다. 저장 시점에는 확산·유래·독립 사용례를 확정하지 않습니다.</p>
        </div>
        <label className="block text-sm font-medium">후보 이름<input name="candidateName" required minLength={2} maxLength={120} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
        <label className="block text-sm font-medium">별칭<textarea name="aliases" rows={2} maxLength={1000} placeholder="쉼표 또는 줄바꿈으로 구분" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">후보 종류<select name="candidateKind" defaultValue="new_meme" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"><option value="new_meme">신규 밈</option><option value="alias">기존 밈 별칭</option><option value="variant">변형</option><option value="revival">재유행</option><option value="popular_content">인기 영상 후보</option></select></label>
          <label className="block text-sm font-medium">기존 밈 UUID<input name="targetMemeId" inputMode="text" placeholder="연결할 때만 입력" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
        </div>
        <label className="block text-sm font-medium">공개 원문 URL<input name="sourceUrl" type="url" inputMode="url" required placeholder="https://…" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">플랫폼<input name="platform" required placeholder="youtube, tiktok, instagram…" pattern="[a-z0-9][a-z0-9_.-]*" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
          <label className="block text-sm font-medium">플랫폼 게시물 ID<input name="platformContentId" maxLength={300} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
          <label className="block text-sm font-medium">작성자 식별자<input name="creatorKey" maxLength={300} placeholder="허용 범위에서 확인된 값" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
          <label className="block text-sm font-medium">원문 게시 시각<input name="publishedAt" type="datetime-local" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
        </div>
        <label className="block text-sm font-medium">관찰 메모<textarea name="note" rows={3} maxLength={2000} placeholder="확인한 범위와 검수가 필요한 점" className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2" /></label>
        <button type="submit" disabled={entryPending} className="min-h-11 rounded-full bg-accent-strong px-4 text-sm font-semibold text-white disabled:opacity-50">{entryPending ? "저장 중…" : "미검수 후보로 저장"}</button>
        {entryState ? <p role={entryState.ok ? "status" : "alert"} className={entryState.ok ? "text-sm text-accent" : "text-sm text-danger"}>{entryState.ok ? entryState.message : entryState.error}</p> : null}
      </form>

      <form action={seedAction} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <div>
          <h2 className="text-lg font-bold">탐색 시드·호출 예산</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">키가 없는 수집기는 실행되지 않아도 시드를 미리 관리할 수 있습니다.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">시드 종류<select name="seedType" defaultValue="term" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"><option value="term">탐색어</option><option value="account">관찰 계정</option><option value="rss">RSS</option><option value="source">지정 출처</option></select></label>
          <label className="block text-sm font-medium">탐색 구간<select name="lane" defaultValue="new_discovery" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3"><option value="new_discovery">신규 후보 탐색</option><option value="candidate_tracking">기존 후보 추적</option></select></label>
        </div>
        <label className="block text-sm font-medium">탐색 값<input name="seedValue" required maxLength={1000} placeholder="밈, 챌린지 또는 공개 HTTPS 주소" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium">플랫폼<input name="seedPlatform" placeholder="선택 사항" pattern="[a-z0-9][a-z0-9_.-]*" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
          <label className="block text-sm font-medium">실행당 호출 예산<input name="callBudget" type="number" min={0} max={1000} step={1} defaultValue={1} required className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3" /></label>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><input name="enabled" type="checkbox" defaultChecked />활성화</label>
        <button type="submit" disabled={seedPending} className="min-h-11 rounded-full border border-border px-4 text-sm font-semibold disabled:opacity-50">{seedPending ? "저장 중…" : "탐색 설정 저장"}</button>
        {seedState ? <p role={seedState.ok ? "status" : "alert"} className={seedState.ok ? "text-sm text-accent" : "text-sm text-danger"}>{seedState.ok ? seedState.message : seedState.error}</p> : null}
      </form>
    </section>
  );
}
