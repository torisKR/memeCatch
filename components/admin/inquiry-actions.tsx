"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerInquiry, setInquiryStatus } from "@/lib/actions/admin-inquiries";
import type { InquiryStatus } from "@/lib/support";

/**
 * 관리자 문의 답변/상태 변경 — 답변 저장 시 status가 answered로 바뀐다.
 * 저장 후 router.refresh()로 서버 목록을 다시 그린다.
 */
export function InquiryActions({
  inquiryId,
  status,
  initialReply,
}: {
  inquiryId: string;
  status: InquiryStatus;
  initialReply: string | null;
}) {
  const router = useRouter();
  const [reply, setReply] = useState(initialReply ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <label htmlFor={`reply-${inquiryId}`} className="block text-xs font-semibold text-muted">
        답변 {status === "answered" ? "(수정 가능)" : ""}
      </label>
      <textarea
        id={`reply-${inquiryId}`}
        rows={3}
        maxLength={4000}
        value={reply}
        onChange={(e) => setReply(e.target.value)}
        placeholder="사용자에게 보낼 답변을 입력해 주세요"
        className="mt-1.5 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {error && (
        <p role="alert" className="mt-1.5 text-sm font-medium text-foreground">
          {error}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || reply.trim().length === 0}
          onClick={() => run(() => answerInquiry({ inquiryId, reply }))}
          className="inline-flex h-10 items-center justify-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {pending ? "저장 중…" : "답변 저장"}
        </button>
        {status !== "closed" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setInquiryStatus({ inquiryId, status: "closed" }))}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
          >
            종료
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setInquiryStatus({ inquiryId, status: "open" }))}
            className="inline-flex h-10 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
          >
            다시 열기
          </button>
        )}
      </div>
    </div>
  );
}
