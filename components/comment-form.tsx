"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { postComment } from "@/lib/actions/community";

const MAX_LEN = 2000;

function draftKey(memeId: string, parentId?: string | null) {
  return `memecatch:comment-draft:${memeId}:${parentId ?? "root"}`;
}

/**
 * 레인 F — 댓글 작성 폼.
 * - 작성 내용은 localStorage에 즉시 보존 → 세션 만료로 로그인 다녀와도 복원돼요.
 * - post_comment RPC(레이트리밋 10개/10분)의 에러를 사용자 문구로 안내.
 */
export function CommentForm({
  memeId,
  parentId = null,
  placeholder = "이 밈, 어디서 처음 봤어요? 편하게 남겨 주세요.",
  autoFocus = false,
  onPosted,
}: {
  memeId: string;
  parentId?: string | null;
  placeholder?: string;
  autoFocus?: boolean;
  onPosted?: () => void;
}) {
  const pathname = usePathname();
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<
    | { kind: "error" | "success"; message: string; loginLink?: boolean }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  // 초안 복원 (재로그인·새로고침 후)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(memeId, parentId));
      // 외부 스토어(localStorage) 복원은 마운트 후 1회 동기화 — effect가 정석 패턴
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setBody(saved);
    } catch {
      // localStorage 접근 불가 환경은 조용히 무시
    }
  }, [memeId, parentId]);

  function handleChange(next: string) {
    setBody(next);
    try {
      const key = draftKey(memeId, parentId);
      if (next.trim()) window.localStorage.setItem(key, next);
      else window.localStorage.removeItem(key);
    } catch {
      /* noop */
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || isPending) return;
    setNotice(null);
    startTransition(async () => {
      const res = await postComment({ memeId, parentId, body });
      if (res.ok) {
        setBody("");
        try {
          window.localStorage.removeItem(draftKey(memeId, parentId));
        } catch {
          /* noop */
        }
        setNotice({ kind: "success", message: "댓글을 남겼어요!" });
        onPosted?.();
      } else {
        setNotice({
          kind: "error",
          message: res.message,
          loginLink: res.error === "login_required",
        });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="sr-only" htmlFor={`comment-body-${parentId ?? "root"}-${memeId}`}>
        댓글 내용
      </label>
      <textarea
        id={`comment-body-${parentId ?? "root"}-${memeId}`}
        value={body}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        maxLength={MAX_LEN}
        rows={parentId ? 2 : 3}
        autoFocus={autoFocus}
        className="w-full resize-y rounded-xl border border-border bg-surface p-3 text-base placeholder:text-muted focus:border-signal-cyan focus:outline-none focus:ring-4 focus:ring-signal-cyan/20"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {body.length.toLocaleString("ko-KR")}/{MAX_LEN.toLocaleString("ko-KR")}자 · 10분에
          최대 10개까지 쓸 수 있어요
        </p>
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="hover-glow-flame holo-sheen inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "남기는 중…" : parentId ? "답글 남기기" : "댓글 남기기"}
        </button>
      </div>
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className="text-base"
          style={{
            color:
              notice.kind === "error" ? "var(--safety-red)" : "var(--safety-green)",
          }}
        >
          {notice.message}
          {notice.loginLink && (
            <>
              {" "}
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="font-semibold underline underline-offset-2"
              >
                로그인하고 이어서 쓰기
              </Link>
            </>
          )}
        </p>
      )}
    </form>
  );
}
