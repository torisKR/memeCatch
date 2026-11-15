"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  recordBrandApproval,
  saveBrandFitEvaluation,
  saveBrandWorkspace,
  type BrandEvaluation,
  type BrandWorkspaceActionState,
  type BrandWorkspaceBundle,
} from "@/lib/actions/brand-workspace";

const initialState: BrandWorkspaceActionState = { ok: false, message: "" };
const field = "mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

function Result({ state }: { state: BrandWorkspaceActionState }) {
  if (!state.message) return null;
  return <p role="status" className={`mt-3 text-sm ${state.ok ? "text-accent" : "text-danger"}`}>{state.message}</p>;
}

function ApprovalForm({ evaluation }: { evaluation: BrandEvaluation }) {
  const [state, action, pending] = useActionState(recordBrandApproval, initialState);
  if (evaluation.approval) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-background p-3 text-sm">
        <strong>{evaluation.approval.decision === "approved" ? "승인됨" : "반려됨"}</strong>
        {evaluation.approval.note ? <p className="mt-1 text-muted">{evaluation.approval.note}</p> : null}
        <time className="mt-1 block text-xs text-muted" dateTime={evaluation.approval.created_at}>
          {new Date(evaluation.approval.created_at).toLocaleString("ko-KR")}
        </time>
      </div>
    );
  }
  return (
    <form action={action} className="mt-4 border-t border-border pt-4">
      <input type="hidden" name="evaluationId" value={evaluation.id} />
      <label className="block text-sm font-semibold" htmlFor={`note-${evaluation.id}`}>결정 메모</label>
      <textarea id={`note-${evaluation.id}`} name="note" maxLength={1000} rows={2} className={field} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button name="decision" value="approved" disabled={pending} className="min-h-11 rounded-lg bg-accent-strong px-4 text-sm font-bold text-white disabled:opacity-50">승인</button>
        <button name="decision" value="rejected" disabled={pending} className="min-h-11 rounded-lg border border-danger px-4 text-sm font-bold text-danger disabled:opacity-50">반려</button>
      </div>
      <Result state={state} />
    </form>
  );
}

function BrandFitShare({ evaluation }: { evaluation: BrandEvaluation }) {
  const [copied, setCopied] = useState(false);
  if (!evaluation.meme_path) return null;
  const risk = evaluation.risk_level === "low" ? "낮음" : evaluation.risk_level === "medium" ? "보통" : "높음";

  async function share() {
    const path = evaluation.meme_path;
    if (!path) return;
    const url = new URL(path, window.location.origin);
    url.searchParams.set("utm_source", "brand_fit_share");
    url.searchParams.set("utm_medium", "share");
    const title = `${evaluation.meme_name} · 내 브랜드 밈 적합도`;
    const text = `${title}\n${evaluation.fit_score}점 · 위험도 ${risk}`;
    try {
      if (navigator.share) await navigator.share({ title, text, url: url.toString() });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        setCopied(true);
      }
    } catch {}
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={share} className="min-h-11 rounded-lg border border-accent px-4 text-sm font-bold text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        {copied ? "결과 링크 복사됨" : "적합도 결과 공유"}
      </button>
      <Link href={evaluation.meme_path} className="inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        밈 상세 보기
      </Link>
      <p role="status" aria-live="polite" className="sr-only">{copied ? "적합도 결과 링크가 복사되었어요." : ""}</p>
    </div>
  );
}

export function BrandWorkspaceForms({ bundle }: { bundle: BrandWorkspaceBundle | null }) {
  const [workspaceState, workspaceAction, workspacePending] = useActionState(saveBrandWorkspace, initialState);
  const [evaluationState, evaluationAction, evaluationPending] = useActionState(saveBrandFitEvaluation, initialState);
  const workspace = bundle?.workspace;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="brand-context-title">
        <h2 id="brand-context-title" className="text-xl font-black">브랜드 기준</h2>
        <form action={workspaceAction} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">브랜드명<input name="brandName" required maxLength={80} defaultValue={workspace?.brand_name} className={field} /></label>
          <label className="block text-sm font-semibold">브랜드 문맥<textarea name="brandContext" required maxLength={2000} rows={5} defaultValue={workspace?.brand_context} className={field} /></label>
          <label className="block text-sm font-semibold">브랜드 톤<textarea name="brandTone" required maxLength={500} rows={3} defaultValue={workspace?.brand_tone} className={field} /></label>
          <label className="block text-sm font-semibold">금지 표현<span className="ml-2 font-normal text-muted">쉼표 또는 줄바꿈으로 구분</span><textarea name="forbiddenExpressions" maxLength={5000} rows={4} defaultValue={workspace?.forbidden_expressions.join("\n")} className={field} /></label>
          <button disabled={workspacePending} className="min-h-11 rounded-lg bg-accent-strong px-4 text-sm font-bold text-white disabled:opacity-50">{workspacePending ? "저장 중…" : "브랜드 기준 저장"}</button>
          <Result state={workspaceState} />
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="fit-title">
        <h2 id="fit-title" className="text-xl font-black">밈 적합도 평가</h2>
        <form action={evaluationAction} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">밈 이름<input name="memeName" required maxLength={120} className={field} /></label>
          <label className="block text-sm font-semibold">밈 상세 경로<input name="memePath" required maxLength={208} pattern="/memes/[^/?#\\s]+" placeholder="/memes/abcd1234-example" className={field} /></label>
          <label className="block text-sm font-semibold">사용 예정 문구<textarea name="proposedCopy" required maxLength={2000} rows={4} className={field} /></label>
          <label className="block text-sm font-semibold">적합도 (0–100)<input name="fitScore" required type="number" min={0} max={100} className={field} /></label>
          <label className="block text-sm font-semibold">위험도<select name="riskLevel" defaultValue="low" className={field}><option value="low">낮음</option><option value="medium">보통</option><option value="high">높음</option></select></label>
          <label className="block text-sm font-semibold">판단 근거<textarea name="rationale" required maxLength={2000} rows={4} className={field} /></label>
          <button disabled={evaluationPending || !workspace} className="min-h-11 rounded-lg bg-accent-strong px-4 text-sm font-bold text-white disabled:opacity-50">{evaluationPending ? "저장 중…" : "평가 저장"}</button>
          {!workspace ? <p className="text-sm text-muted">브랜드 기준을 먼저 저장해 주세요.</p> : null}
          <Result state={evaluationState} />
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 lg:col-span-2" aria-labelledby="history-title">
        <h2 id="history-title" className="text-xl font-black">평가 및 승인 기록</h2>
        {bundle?.evaluations.length ? (
          <ol className="mt-5 grid gap-4 md:grid-cols-2">
            {bundle.evaluations.map((evaluation) => (
              <li key={evaluation.id} className="rounded-xl border border-border bg-surface-2 p-4">
                <div className="flex items-start justify-between gap-3"><h3 className="font-black">{evaluation.meme_name}</h3><span className="rounded-full bg-background px-2 py-1 text-xs font-bold">{evaluation.fit_score}점 · {evaluation.risk_level === "low" ? "낮음" : evaluation.risk_level === "medium" ? "보통" : "높음"}</span></div>
                <p className="mt-3 whitespace-pre-wrap text-sm">{evaluation.proposed_copy}</p>
                <p className="mt-2 text-sm text-muted">{evaluation.rationale}</p>
                {evaluation.matched_forbidden_expressions.length ? (
                  <p role="alert" className="mt-3 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm font-semibold text-danger">
                    금지 표현 감지: {evaluation.matched_forbidden_expressions.join(", ")}
                  </p>
                ) : (
                  <p className="mt-3 text-sm font-semibold text-accent-text">금지 표현 없음</p>
                )}
                <BrandFitShare evaluation={evaluation} />
                <ApprovalForm evaluation={evaluation} />
              </li>
            ))}
          </ol>
        ) : <p className="mt-3 text-sm text-muted">저장된 평가가 아직 없어요.</p>}
      </section>
    </div>
  );
}
