"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CategoryTag } from "@/components/category-tag";
import { MarkdownBody } from "@/components/markdown-body";
import { createCommunityPost } from "@/app/community/actions";
import { uploadCommunityMedia, UPLOAD_ACCEPT_MEDIA } from "@/lib/upload";
import type { MemeCategory } from "@/lib/labels";

const TITLE_MAX = 100;
// DB check 제약(community_posts.body ≤ 5000)과 일치 — 상향 시 마이그레이션 필요
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
 * 제목/본문(마크다운, 쓰기·미리보기 탭) + 밈 검색 첨부(선택, search_memes RPC).
 * 이미지/동영상은 드래그앤드롭·붙여넣기·파일 선택으로 /api/upload에 올리고
 * 커서 위치에 `![파일명](URL)`(이미지) 또는 `[동영상](URL)`(비디오) 삽입 —
 * 규약은 lib/markdown.ts(MarkdownBody 렌더러)와 일치.
 * 초안은 localStorage 보존(로그인 왕복 대비). 성공 시 글 상세로 이동.
 */
export function CommunityPostForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
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
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // 드롭존 자식 요소 통과 시 dragleave 깜빡임 방지용 카운터
  const dragDepth = useRef(0);

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

  // ── 에디터 헬퍼 ─────────────────────────────────────────
  /** 커서 위치에 스니펫 삽입 — 순차 업로드 중에도 textarea.value가 항상 최신 원본 */
  function insertAtCursor(snippet: string) {
    const el = bodyRef.current;
    const current = el ? el.value : body;
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + snippet + current.slice(end);
    if (next.length > BODY_MAX) {
      setNotice({
        kind: "error",
        message: `본문은 ${BODY_MAX.toLocaleString("ko-KR")}자까지 쓸 수 있어요.`,
      });
      return;
    }
    setBody(next);
    persistDraft(title, next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  }

  /** 선택 영역을 prefix/suffix로 감싸기 (굵게·링크 버튼) */
  function wrapSelection(prefix: string, suffix: string, placeholder: string) {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const current = el.value;
    const selected = current.slice(start, end) || placeholder;
    const next =
      current.slice(0, start) + prefix + selected + suffix + current.slice(end);
    if (next.length > BODY_MAX) return;
    setBody(next);
    persistDraft(title, next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  /** 파일들 순차 업로드 → 마크다운 삽입. 이미지 `![이름](URL)` / 동영상 `[동영상](URL)` */
  async function handleFiles(files: File[]) {
    if (files.length === 0 || uploading) return;
    setNotice(null);
    setTab("write");
    setUploading(true);
    try {
      for (const file of files) {
        const res = await uploadCommunityMedia(file);
        if (!res.ok) {
          setNotice({
            kind: "error",
            message: res.error,
            loginLink: res.code === "login_required",
          });
          continue;
        }
        // 서빙은 /api/media 프록시 경유 (R2 비공개 유지)
        const url = `/api/media/${res.path}`;
        const isVideo = file.type.startsWith("video/");
        if (isVideo) {
          insertAtCursor(`\n[동영상](${url})\n`);
        } else {
          // 파일명에서 마크다운 구문 충돌 문자 제거
          const name = file.name.replace(/[[\]()]/g, "").trim() || "이미지";
          insertAtCursor(`\n![${name}](${url})\n`);
        }
      }
    } finally {
      setUploading(false);
    }
  }

  // ── 밈 검색 (300ms 디바운스) — 이벤트 핸들러에서 예약 (effect 내 setState 회피)
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
    if (isPending || uploading || title.trim().length < 2 || !body.trim()) return;
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

  // 시각적으로는 h-9(36px) 컴팩트 유지 + before 가상요소로 히트박스만 ~44px까지 확장(explore-filters.tsx 패턴)
  const toolbarBtn =
    "relative flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold text-muted transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-2 hover:text-foreground disabled:opacity-50";

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

      {/* 본문 — 마크다운 에디터 (쓰기/미리보기 + 드래그앤드롭·붙여넣기 업로드) */}
      <div>
        <label htmlFor="post-body" className="text-sm font-semibold">
          내용
        </label>
        <div
          onDragEnter={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            dragDepth.current += 1;
            setDragOver(true);
          }}
          onDragOver={(e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
          }}
          onDragLeave={() => {
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            dragDepth.current = 0;
            setDragOver(false);
            void handleFiles(Array.from(e.dataTransfer.files));
          }}
          className={`mt-1.5 overflow-hidden rounded-xl border bg-surface transition-colors focus-within:ring-4 focus-within:ring-accent/20 ${
            dragOver
              ? "border-dashed border-accent ring-4 ring-accent/20"
              : "border-border focus-within:border-accent"
          }`}
        >
          {/* 툴바 */}
          <div className="flex items-center gap-0.5 border-b border-border px-2 py-1.5">
            <button
              type="button"
              onClick={() => setTab("write")}
              aria-pressed={tab === "write"}
              className={`${toolbarBtn} ${tab === "write" ? "bg-surface-2 text-foreground" : ""}`}
            >
              쓰기
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              aria-pressed={tab === "preview"}
              className={`${toolbarBtn} ${tab === "preview" ? "bg-surface-2 text-foreground" : ""}`}
            >
              미리보기
            </button>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <button
              type="button"
              onClick={() => wrapSelection("**", "**", "굵은 텍스트")}
              disabled={uploading || tab === "preview"}
              aria-label="굵게"
              title="굵게"
              className={toolbarBtn}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("[", "](https://)", "링크 텍스트")}
              disabled={uploading || tab === "preview"}
              aria-label="링크"
              title="링크"
              className={toolbarBtn}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || tab === "preview"}
              aria-label="이미지·동영상 올리기"
              title="이미지·동영상 올리기"
              className={toolbarBtn}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="8.5" cy="10" r="1.5" />
                <path d="m21 15-4.5-4.5L9 18" />
              </svg>
            </button>
            {uploading && (
              <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-sm text-muted" role="status">
                <svg viewBox="0 0 24 24" className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                  <path d="M12 3a9 9 0 1 0 9 9" />
                </svg>
                업로드 중…
              </span>
            )}
          </div>

          {/* 쓰기(textarea는 상태 보존 위해 숨김 처리만) */}
          <textarea
            id="post-body"
            ref={bodyRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              persistDraft(title, e.target.value);
            }}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData.files);
              if (files.length > 0) {
                e.preventDefault();
                void handleFiles(files);
              }
            }}
            maxLength={BODY_MAX}
            rows={10}
            placeholder="밈 추천, 추억, 토론 — 뭐든 편하게 써 주세요."
            className={`w-full resize-y bg-transparent p-3 text-base placeholder:text-muted focus:outline-none ${
              tab === "preview" ? "hidden" : ""
            }`}
          />
          {tab === "preview" && (
            <div className="min-h-40 p-3">
              {body.trim() ? (
                <MarkdownBody>{body}</MarkdownBody>
              ) : (
                <p className="text-base text-muted">미리 볼 내용이 없어요.</p>
              )}
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={UPLOAD_ACCEPT_MEDIA}
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = ""; // 같은 파일 재선택 허용
            void handleFiles(files);
          }}
        />

        <p className="mt-1 text-sm text-muted">
          마크다운 지원 · 이미지/영상을 끌어다 놓거나 붙여넣으면 업로드돼요 ·{" "}
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
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-2"
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
          disabled={isPending || uploading || title.trim().length < 2 || !body.trim()}
          className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-50"
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
