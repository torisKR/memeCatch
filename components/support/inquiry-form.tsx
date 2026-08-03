"use client";

import { useState, useTransition } from "react";
import { createInquiry } from "@/lib/actions/support";
import {
  INQUIRY_CATEGORIES,
  INQUIRY_CATEGORY_LABEL,
  type InquiryCategory,
} from "@/lib/support";

/**
 * 고객센터 문의 작성 폼 — 로그인 상태에서만 렌더된다(페이지가 보장).
 * 성공 시 서버 액션의 revalidatePath("/support")로 목록이 갱신된다.
 */
export function InquiryForm() {
  const [category, setCategory] = useState<InquiryCategory>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setNotice(null);
    startTransition(async () => {
      const result = await createInquiry({ category, subject, body });
      if (result.ok) {
        setSubject("");
        setBody("");
        setNotice({ kind: "ok", text: "문의를 접수했어요. 답변이 등록되면 이 페이지에서 볼 수 있어요." });
      } else {
        setNotice({ kind: "error", text: result.message });
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="inquiry-category" className="block text-sm font-semibold text-foreground">
          문의 유형
        </label>
        <select
          id="inquiry-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as InquiryCategory)}
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {INQUIRY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {INQUIRY_CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="inquiry-subject" className="block text-sm font-semibold text-foreground">
          제목
        </label>
        <input
          id="inquiry-subject"
          type="text"
          required
          maxLength={120}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="문의 내용을 한 줄로 요약해 주세요"
          className="mt-1.5 h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="inquiry-body" className="block text-sm font-semibold text-foreground">
          내용
        </label>
        <textarea
          id="inquiry-body"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="자세히 적어 주실수록 빠르고 정확하게 도와드릴 수 있어요. (10자 이상)"
          className="mt-1.5 w-full resize-y rounded-xl border border-border bg-surface px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <p className="mt-1 text-right text-xs text-muted">{body.length.toLocaleString()}/2,000</p>
      </div>

      {notice && (
        <p
          role="status"
          className={`rounded-xl px-3 py-2.5 text-sm ${
            notice.kind === "ok"
              ? "bg-accent-soft text-accent"
              : "bg-surface-2 font-medium text-foreground"
          }`}
        >
          {notice.text}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:min-w-40"
      >
        {pending ? "보내는 중…" : "문의 보내기"}
      </button>
    </form>
  );
}
