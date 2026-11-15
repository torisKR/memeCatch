"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { flags } from "@/lib/flags";
import { CommentForm } from "@/components/comment-form";
import { CommunityGate } from "@/components/community-gate";
import { reportContent } from "@/lib/actions/community";
import type { Database } from "@/lib/database.types";

type DiscussionStatus = Database["public"]["Enums"]["discussion_status"];

type CommentRow = {
  id: string;
  parent_id: string | null;
  body: string;
  status: DiscussionStatus;
  created_at: string;
  user_id: string;
  profiles: { nickname: string } | null;
};

function timeAgo(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

/**
 * 레인 F — 밈 상세용 댓글 섹션 (독립 export, 레인 B가 <Comments memeId={...} />로 삽입).
 * communityEnabled=false면 CommunityGate로 대체.
 */
export function Comments({ memeId }: { memeId: string }) {
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [error, setError] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("discussions")
      // profiles 임베드는 FK 명시 필수 (discussion_reactions 경유 M2M과 모호성 발생)
      .select(
        "id,parent_id,body,status,created_at,user_id,profiles!discussions_user_id_fkey(nickname)"
      )
      .eq("meme_id", memeId)
      .order("created_at", { ascending: true });
    if (err) {
      setError(true);
      return;
    }
    setError(false);
    setComments((data ?? []) as unknown as CommentRow[]);
  }, [memeId]);

  useEffect(() => {
    // 비동기 데이터 페칭 후 setState — await 이후라 cascading render 아님(규칙 오탐)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (flags.communityEnabled) void fetchComments();
  }, [fetchComments]);

  if (!flags.communityEnabled) {
    return <CommunityGate />;
  }

  const topLevel = (comments ?? [])
    .filter((c) => c.parent_id === null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const repliesOf = (id: string) =>
    (comments ?? []).filter((c) => c.parent_id === id);

  return (
    <section aria-label="댓글" className="space-y-4">
      <h2 className="text-lg font-bold">
        댓글{comments ? ` ${comments.length.toLocaleString("ko-KR")}` : ""}
      </h2>

      <CommentForm memeId={memeId} onPosted={fetchComments} />

      {/* 로딩 스켈레톤 */}
      {comments === null && !error && (
        <ul className="space-y-3" aria-hidden>
          {[0, 1, 2].map((i) => (
            <li key={i} className="instrument-grid animate-pulse rounded-xl bg-surface-2 p-4">
              <div className="h-4 w-24 rounded bg-border" />
              <div className="mt-2 h-4 w-full rounded bg-border" />
            </li>
          ))}
        </ul>
      )}

      {/* 에러 */}
      {error && (
        <div role="alert" className="rounded-xl border border-border bg-surface-2 p-4 text-center">
          <p className="text-base text-muted">댓글을 불러오지 못했어요.</p>
          <button
            type="button"
            onClick={() => {
              setComments(null);
              void fetchComments();
            }}
            className="mt-2 inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold"
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 빈 상태 */}
      {comments !== null && !error && topLevel.length === 0 && (
        <p className="rounded-xl bg-surface-2 p-6 text-center text-base text-muted">
          아직 댓글이 없어요. 첫 댓글을 남겨보세요!
        </p>
      )}

      {/* 목록 */}
      <ul className="space-y-4">
        {topLevel.map((c) => (
          <li key={c.id}>
            <CommentItem
              comment={c}
              memeId={memeId}
              replying={replyTo === c.id}
              onToggleReply={() => setReplyTo(replyTo === c.id ? null : c.id)}
              onPosted={() => {
                setReplyTo(null);
                void fetchComments();
              }}
            />
            {repliesOf(c.id).length > 0 && (
              <ul className="mt-3 space-y-3 border-l-2 border-border pl-4">
                {repliesOf(c.id).map((r) => (
                  <li key={r.id}>
                    <CommentItem comment={r} memeId={memeId} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CommentItem({
  comment,
  memeId,
  replying = false,
  onToggleReply,
  onPosted,
}: {
  comment: CommentRow;
  memeId: string;
  replying?: boolean;
  onToggleReply?: () => void;
  onPosted?: () => void;
}) {
  const masked = comment.status !== "visible";
  // 댓글은 무제한 조회 리스트 — backdrop-blur(.glass-panel)는 카드 수만큼
  // GPU 비용이 누적되므로 블러 없는 반투명으로 같은 톤만 낸다(성능 리뷰 HIGH).
  return (
    <article className="rounded-xl border border-foreground/10 bg-surface-2/80 p-4">
      <header className="flex items-center gap-2 text-sm text-muted">
        <span className="font-semibold text-foreground">
          {comment.profiles?.nickname ?? "익명"}
        </span>
        <time dateTime={comment.created_at}>{timeAgo(comment.created_at)}</time>
      </header>
      {masked ? (
        <p className="mt-1 text-base italic text-muted">
          {comment.status === "deleted" ? "삭제된 댓글이에요" : "가려진 댓글이에요"}
        </p>
      ) : (
        <p className="mt-1 whitespace-pre-wrap text-base">{comment.body}</p>
      )}
      {!masked && (
        <div className="mt-2 flex items-center gap-1">
          {onToggleReply && (
            <button
              type="button"
              onClick={onToggleReply}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted"
            >
              {replying ? "답글 닫기" : "답글"}
            </button>
          )}
          <ReportButton targetId={comment.id} />
        </div>
      )}
      {replying && onPosted && (
        <div className="mt-2">
          <CommentForm
            memeId={memeId}
            parentId={comment.id}
            placeholder="답글을 남겨 주세요."
            autoFocus
            onPosted={onPosted}
          />
        </div>
      )}
    </article>
  );
}

function ReportButton({ targetId }: { targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ kind: "error" | "success"; message: string } | null>(
    null
  );
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || isPending) return;
    startTransition(async () => {
      const res = await reportContent({
        targetType: "discussion",
        targetId,
        reason,
      });
      if (res.ok) {
        setNotice({ kind: "success", message: "신고가 접수됐어요. 검토 후 처리할게요." });
        setReason("");
        setOpen(false);
      } else {
        setNotice({ kind: "error", message: res.message });
      }
    });
  }

  return (
    <div className="flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="hover-glow-flame inline-flex min-h-11 items-center rounded-full px-3 text-sm font-medium text-muted"
      >
        신고
      </button>
      {open && (
        <form onSubmit={submit} className="mt-1 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`report-reason-${targetId}`}>
            신고 사유
          </label>
          <input
            id={`report-reason-${targetId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="어떤 점이 문제인지 알려 주세요"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-base placeholder:text-muted"
          />
          <button
            type="submit"
            disabled={isPending || !reason.trim()}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-base font-semibold disabled:opacity-50"
          >
            {isPending ? "접수 중…" : "신고하기"}
          </button>
        </form>
      )}
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className="mt-1 text-sm"
          style={{
            color:
              notice.kind === "error" ? "var(--safety-red)" : "var(--safety-green)",
          }}
        >
          {notice.message}
        </p>
      )}
    </div>
  );
}
