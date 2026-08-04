import type { Metadata } from "next";
import { ForumPostingJsonLd } from "@/components/json-ld";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStaticClient } from "@/lib/supabase/server";
import { CommunityLikeButton } from "@/components/community-like-button";
import { CommunityCommentForm } from "@/components/community-comment-form";
import { CommunityMemeChip } from "@/components/community-post-card";
import { MarkdownBody } from "@/components/markdown-body";
import { stripMarkdownToText } from "@/lib/markdown";
import {
  POST_SELECT,
  timeAgo,
  type CommunityCommentRow,
  type CommunityPostRow,
} from "../shared";
import { AdsenseScript } from "@/components/adsense-script";

/**
 * 레인 3 — 커뮤니티 글 상세 + 댓글.
 * 공개 읽기(createStaticClient). 댓글 작성은 CommunityCommentForm(클라이언트,
 * login_required → /login?next= 유도), 좋아요는 낙관적 토글.
 * community_* 테이블은 database.types.ts에 아직 없어 무타입 캐스팅.
 * // TODO: types regen 후 정리
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

async function getPost(id: string): Promise<CommunityPostRow | null> {
  if (!UUID_RE.test(id)) return null;
  try {
    const supabase = createStaticClient() as unknown as SupabaseClient;
    const { data } = await supabase
      .from("community_posts")
      .select(POST_SELECT)
      .eq("id", id)
      .eq("status", "visible")
      .maybeSingle();
    return (data as unknown as CommunityPostRow) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: "글을 찾을 수 없어요" };
  // 메타 설명은 마크다운 구문(이미지/링크)을 벗긴 플레인 텍스트로
  const description = stripMarkdownToText(post.body).slice(0, 120);
  return {
    title: post.title,
    description,
    // 루트 canonical("/") 상속 방지 — 글별 canonical 명시
    alternates: { canonical: `/community/${post.id}` },
    // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
    openGraph: {
      type: "website",
      siteName: "밈캐치",
      locale: "ko_KR",
      title: post.title,
      description,
      url: `/community/${post.id}`,
    },
  };
}

export default async function CommunityPostPage({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();

  let comments: CommunityCommentRow[] = [];
  try {
    const supabase = createStaticClient() as unknown as SupabaseClient;
    const { data } = await supabase
      .from("community_comments")
      .select(
        "id,post_id,user_id,body,created_at,profiles!community_comments_user_id_fkey(nickname)"
      )
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    comments = (data ?? []) as unknown as CommunityCommentRow[];
  } catch {
    comments = [];
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-14 pt-6">
      <AdsenseScript />
      <ForumPostingJsonLd
        postId={post.id}
        title={post.title}
        body={post.body}
        authorNickname={post.profiles?.nickname ?? "익명"}
        createdAt={post.created_at}
        likeCount={post.like_count}
        commentCount={comments.length}
      />
      <nav aria-label="뒤로 가기">
        <Link
          href="/community"
          className="inline-flex min-h-11 items-center gap-1 text-base font-semibold text-muted transition-colors hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 6-6 6 6 6" />
          </svg>
          커뮤니티
        </Link>
      </nav>

      <article className="hover-glow-flame rounded-2xl border border-border bg-surface p-5">
        <header>
          <h1 className="text-2xl font-extrabold leading-snug">{post.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <span id="author" className="font-semibold text-foreground">
              {post.profiles?.nickname ?? "익명"}
            </span>
            <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
          </p>
        </header>

        {/* 본문 — 마크다운 렌더(raw HTML 미렌더로 XSS 안전, remark-breaks로
            기존 플레인 텍스트 글의 줄바꿈도 그대로 보이는 하위호환) */}
        <MarkdownBody className="mt-4">{post.body}</MarkdownBody>

        {post.memes && <CommunityMemeChip meme={post.memes} className="mt-5" />}

        <div className="mt-5 border-t border-border pt-4">
          <CommunityLikeButton postId={post.id} initialCount={post.like_count} />
        </div>
      </article>

      <section aria-label="댓글" className="space-y-4">
        <h2 className="text-lg font-bold">
          댓글{" "}
          <span className="stat-mono text-(--signal-cyan)">
            {comments.length.toLocaleString("ko-KR")}
          </span>
        </h2>

        <CommunityCommentForm postId={post.id} />

        {comments.length === 0 ? (
          <p className="rounded-xl bg-surface-2 p-6 text-center text-base text-muted">
            아직 댓글이 없어요. 첫 댓글을 남겨보세요!
          </p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li key={c.id}>
                <article className="rounded-xl bg-surface-2 p-4">
                  <header className="flex items-center gap-2 text-sm text-muted">
                    <span className="font-semibold text-foreground">
                      {c.profiles?.nickname ?? "익명"}
                    </span>
                    <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>
                  </header>
                  <p className="mt-1 whitespace-pre-wrap text-base">{c.body}</p>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
