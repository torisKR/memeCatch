"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createCommunityComment } from "@/app/community/actions";

const MAX_LEN = 1000;

function draftKey(postId: string) {
  return `memecatch:community-comment-draft:${postId}`;
}

/**
 * 레인 3 — 커뮤니티 글 댓글 작성 폼 (comment-form 패턴 재사용).
 * - 작성 내용 localStorage 보존 → 로그인 다녀와도 복원.
 * - login_required면 /login?next=현재 경로 링크로 유도(기존 로그인 유도 패턴).
 * - 성공 시 router.refresh()로 서버 렌더 댓글 목록 갱신.
 */
export function CommunityCommentForm({ postId }: { postId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState<
    | { kind: "error" | "success"; message: string; loginLink?: boolean }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();

  // 초안 복원 (재로그인·새로고침 후)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(draftKey(postId));
      // 외부 스토어(localStorage) 복원은 마운트 후 1회 동기화 — effect가 정석 패턴
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setBody(saved);
    } catch {
      // localStorage 접근 불가 환경은 조용히 무시
    }
  }, [postId]);

  function handleChange(next: string) {
    setBody(next);
    try {
      if (next.trim()) window.localStorage.setItem(draftKey(postId), next);
      else window.localStorage.removeItem(draftKey(postId));
    } catch {
      /* noop */
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || isPending) return;
    setNotice(null);
    startTransition(async () => {
      const res = await createCommunityComment({ postId, body });
      if (res.ok) {
        setBody("");
        try {
          window.localStorage.removeItem(draftKey(postId));
        } catch {
          /* noop */
        }
        setNotice({ kind: "success", message: "댓글을 남겼어요!" });
        router.refresh();
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
      <label className="sr-only" htmlFor={`community-comment-${postId}`}>
        댓글 내용
      </label>
      <textarea
        id={`community-comment-${postId}`}
        value={body}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="이 글에 하고 싶은 말을 남겨 주세요."
        maxLength={MAX_LEN}
        rows={3}
        className="w-full resize-y rounded-xl border border-border bg-surface p-3 text-base placeholder:text-muted focus:outline-none"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">
          {body.length.toLocaleString("ko-KR")}/{MAX_LEN.toLocaleString("ko-KR")}자
          · 10분에 최대 10개까지 쓸 수 있어요
        </p>
        <button
          type="submit"
          disabled={isPending || !body.trim()}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent-strong px-5 text-base font-semibold text-white disabled:opacity-50"
        >
          {isPending ? "남기는 중…" : "댓글 남기기"}
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
