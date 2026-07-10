"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CategoryTag } from "@/components/category-tag";
import { createCommunityPost } from "@/app/community/actions";
import type { MemeCategory } from "@/lib/labels";

const TITLE_MAX = 100;
const BODY_MAX = 5000;
const DRAFT_KEY = "memecatch:community-post-draft";

type MemePick = {
  id: string;
  title: string;
  summary: string;
  category: MemeCategory;
};

/**
 * 레인 3 — 커뮤니티 글쓰기 폼.
 * 제목/본문 + 밈 검색 첨부(선택, search_memes RPC).
 * 초안은 localStorage 보존(로그인 왕복 대비). 성공 시 글 상세로 이동.
 */
export function CommunityPostForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [meme, setMeme] = useState<MemePick | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MemePick[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<
    | { kind: "error" | "success"; message: string; loginLink?: boolean }
    | null
  >(null);
  const [isPending, startTransition] = useTransition();
  const searchSeq = useRef(0);

  // 초안 복원
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const draft = JSON.parse(saved) as { title?: string; body?: string };
        // 외부 스토어(localStorage) 복원은 마운트 후 1회 동기화 — effect가 정석 패턴
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (draft.title) setTitle(draft.title);
        if (draft.body) setBody(draft.body);
      }
    } catch {
      /* noop */
    }
  }, []);

  function persistDraft(nextTitle: string, nextBody: string) {
    try {
      if (nextTitle.trim() || nextBody.trim()) {
        window.localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ title: nextTitle, body: nextBody })
        );
      } else {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      /* noop */
    }
  }

  // 밈 검색 (300ms 디바운스) — 이벤트 핸들러에서 예약 (effect 내 setState 회피)
  const searchTimer = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    };
  }, []);

  function handleQueryChange(next: string) {
    setQuery(next);
    if (searchTimer.current !== null) window.clearTimeout(searchTimer.current);
    const q = next.trim();
    if (!q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    searchTimer.current = window.setTimeout(async () => {
      const { data } = await createClient().rpc("search_memes", {
        p_query: q,
        p_limit: 5,
      });
      if (seq !== searchSeq.current) return;
      setSearching(false);
      setResults(
        ((data ?? []) as Array<{
          id: string;
          title: string;
          summary: string;
          category: MemeCategory;
        }>).map((m) => ({
          id: m.id,
          title: m.title,
          summary: m.summary,
          category: m.category,
        }))
      );
    }, 300);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPending || title.trim().length < 2 || !body.trim()) return;
    setNotice(null);
    startTransition(async () => {
      const res = await createCommunityPost({
        title,
        body,
        memeId: meme?.id ?? null,
      });
      if (res.ok) {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          /* noop */
        }
        router.push(`/community/${res.data.postId}`);
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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 제목 */}
      <div>
        <label htmlFor="post-title" className="text-sm font-semibold">
          제목
        </label>
        <input
          id="post-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            persistDraft(e.target.value, body);
          }}
          maxLength={TITLE_MAX}
          placeholder="예) 요즘 이 밈 아직도 쓰는 사람 있나요?"
          className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-3 text-base placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
        />
        <p className="mt-1 text-sm text-muted">
          {title.length.toLocaleString("ko-KR")}/{TITLE_MAX}자 · 2자 이상
        </p>
      </div>

      {/* 본문 */}
      <div>
        <label htmlFor="post-body" className="text-sm font-semibold">
          내용
        </label>
        <textarea
          id="post-body"
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            persistDraft(title, e.target.value);
          }}
          maxLength={BODY_MAX}
          rows={8}
          placeholder="밈 추천, 추억, 토론 — 뭐든 편하게 써 주세요."
          className="mt-1.5 w-full resize-y rounded-xl border border-border bg-surface p-3 text-base placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
        />
        <p className="mt-1 text-sm text-muted">
          {body.length.toLocaleString("ko-KR")}/{BODY_MAX.toLocaleString("ko-KR")}자
        </p>
      </div>

      {/* 밈 첨부 (선택) */}
      <fieldset>
        <legend className="text-sm font-semibold">
          밈 첨부 <span className="font-normal text-muted">(선택)</span>
        </legend>
        {meme ? (
          <div className="mt-1.5 flex min-h-11 items-center gap-2.5 rounded-xl border border-accent bg-accent-soft/40 px-3 py-2">
            <CategoryTag category={meme.category} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{meme.title}</span>
              <span className="block truncate text-xs text-muted">
                {meme.summary}
              </span>
            </span>
            <button
              type="button"
              onClick={() => setMeme(null)}
              aria-label="밈 첨부 해제"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="밈 이름으로 검색해서 첨부해요"
              aria-label="첨부할 밈 검색"
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-3 text-base placeholder:text-muted focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/20"
            />
            {query.trim() && (
              <ul className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
                {searching && (
                  <li className="px-3 py-3 text-sm text-muted">검색 중…</li>
                )}
                {!searching && results !== null && results.length === 0 && (
                  <li className="px-3 py-3 text-sm text-muted">
                    검색 결과가 없어요.
                  </li>
                )}
                {!searching &&
                  (results ?? []).map((m) => (
                    <li key={m.id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setMeme(m);
                          setQuery("");
                          setResults(null);
                        }}
                        className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <CategoryTag category={m.category} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">
                            {m.title}
                          </span>
                          <span className="block truncate text-xs text-muted">
                            {m.summary}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </fieldset>

      {/* 제출 */}
      <div>
        <button
          type="submit"
          disabled={isPending || title.trim().length < 2 || !body.trim()}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {isPending ? "올리는 중…" : "글 올리기"}
        </button>
        <p className="mt-1.5 text-center text-sm text-muted">
          1시간에 최대 5개까지 쓸 수 있어요.
        </p>
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
                href="/login?next=/community/new"
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
