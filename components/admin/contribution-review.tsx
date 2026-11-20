"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewMemeContribution } from "@/lib/actions/admin";

export type ContributionQueueItem = {
  id: string;
  kind: "source" | "example";
  sourceUrl: string | null;
  note: string | null;
  situation: string | null;
  text: string | null;
  creditPublic: boolean;
  contributorNickname: string | null;
  memeTitle: string;
  memePath: string | null;
  createdAtLabel: string;
};

/**
 * 문서 보강 제보 한 건 — 밈 상세에서 받은 출처 링크·사용 예문.
 * 새 밈 제보와 달리 밈을 만들지 않는다. 승인하면 그 밈의 출처 목록이나 예문에 바로 붙는다.
 */
export function ContributionReview({ item }: { item: ContributionQueueItem }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [sourceTitle, setSourceTitle] = useState(item.note ?? "");
  const [situation, setSituation] = useState(item.situation ?? "");
  const [text, setText] = useState(item.text ?? "");
  const [rejectReason, setRejectReason] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [done, setDone] = useState(false);

  function submit(decision: "approve" | "reject") {
    setMessage(null);
    startTransition(async () => {
      const res = await reviewMemeContribution({
        contributionId: item.id,
        decision,
        sourceTitle: item.kind === "source" ? sourceTitle : undefined,
        situation: item.kind === "example" ? situation : undefined,
        text: item.kind === "example" ? text : undefined,
        rejectReason: decision === "reject" ? rejectReason : undefined,
      });
      if (!res.ok) {
        setMessage({ kind: "error", text: res.error });
        return;
      }
      setDone(true);
      setMessage({
        kind: "success",
        text: decision === "approve" ? "승인하고 문서에 반영했어요." : "반려했어요.",
      });
      router.refresh();
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-base focus:outline-none";
  const busy = pending || done;

  return (
    <article className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-sm font-semibold">
          {item.kind === "source" ? "출처 링크" : "사용 예문"}
        </span>
        {item.memePath ? (
          <a href={item.memePath} target="_blank" rel="noreferrer" className="text-lg font-semibold underline">
            {item.memeTitle}
          </a>
        ) : (
          <span className="text-lg font-semibold">{item.memeTitle}</span>
        )}
        <span className="text-sm text-muted">
          {item.contributorNickname ?? "탈퇴한 사용자"}
          {item.creditPublic ? " · 이름 공개 동의" : " · 이름 비공개"} · {item.createdAtLabel}
        </span>
      </div>

      {item.kind === "source" ? (
        <div className="space-y-2">
          <a
            href={item.sourceUrl ?? "#"}
            target="_blank"
            rel="noreferrer noopener"
            className="block break-all text-base text-accent-text underline"
          >
            {item.sourceUrl}
          </a>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              자료 제목 (공개 출처 목록에 표시, 비우면 링크만)
            </span>
            <input
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              maxLength={300}
              disabled={busy}
              className={inputCls}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">상황</span>
            <input
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              maxLength={120}
              disabled={busy}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">예문</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={2}
              maxLength={500}
              disabled={busy}
              className={inputCls}
            />
          </label>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-base ${
            message.kind === "error" ? "bg-safety-red-bg text-safety-red" : "bg-safety-green-bg text-safety-green"
          }`}
        >
          {message.text}
        </p>
      )}

      {mode === "reject" && !done && (
        <label className="block">
          <span className="mb-1 block text-sm font-medium">반려 사유 (필수, 제보자에게 보여요)</span>
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            maxLength={500}
            disabled={busy}
            className={inputCls}
          />
        </label>
      )}

      {!done && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => submit("approve")}
            disabled={busy || mode === "reject"}
            className="min-h-11 rounded-lg bg-accent-strong px-4 text-base font-semibold text-white disabled:opacity-50"
          >
            {pending ? "처리 중…" : "승인 → 문서에 반영"}
          </button>
          {mode === "reject" ? (
            <>
              <button
                type="button"
                onClick={() => submit("reject")}
                disabled={busy || !rejectReason.trim()}
                className="min-h-11 rounded-lg bg-safety-red px-4 text-base font-semibold text-background disabled:opacity-50"
              >
                반려하기
              </button>
              <button
                type="button"
                onClick={() => setMode("idle")}
                disabled={busy}
                className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-base font-semibold"
              >
                취소
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMode("reject")}
              disabled={busy}
              className="min-h-11 rounded-lg border border-border bg-surface-2 px-4 text-base font-semibold disabled:opacity-50"
            >
              반려
            </button>
          )}
        </div>
      )}
    </article>
  );
}
