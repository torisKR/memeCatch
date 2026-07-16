import Link from "next/link";
import { memePathFrom } from "@/lib/labels";
import { CategoryTag } from "@/components/category-tag";
import {
  timeAgo,
  type CommunityMemeMini,
  type CommunityPostRow,
} from "@/app/community/shared";

/**
 * 레인 3 — 커뮤니티 글 카드 (목록용, 서버 렌더).
 * 작성자 닉네임 · 상대시간 → 제목(주인공) → 본문 2줄 프리뷰
 * → 밈 첨부 미니 카드(옵션) → 좋아요·댓글 수.
 * 터치 타깃: 제목 링크의 ::after를 카드 전체로 확장(stretched-link) —
 * 카드 전체가 탭 영역이 되고, 밈칩 링크만 z-10으로 위에 떠서 개별 클릭 가능.
 */
export function CommunityPostCard({ post }: { post: CommunityPostRow }) {
  return (
    <article className="relative rounded-2xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
      <header className="flex items-center gap-2 text-sm text-muted">
        <span className="font-semibold text-foreground">
          {post.profiles?.nickname ?? "익명"}
        </span>
        <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
      </header>

      <h2 className="mt-1.5">
        <Link
          href={`/community/${post.id}`}
          className="text-lg font-extrabold leading-snug underline-offset-2 after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {post.title}
        </Link>
      </h2>

      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-base leading-relaxed text-muted">
        {post.body}
      </p>

      {post.memes && (
        // max-w-full 필수: w-fit은 내용의 max-content로 커져 긴 밈 제목에서
        // 컨테이너를 뚫고 가로 스크롤을 만든다(내부 truncate가 동작하려면 상한 필요)
        <div className="relative z-10 mt-3 w-fit max-w-full">
          <CommunityMemeChip meme={post.memes} />
        </div>
      )}

      <footer className="mt-3 flex items-center gap-4 text-sm text-muted">
        <span className="inline-flex items-center gap-1">
          <HeartIcon className="h-4 w-4" />
          {post.like_count.toLocaleString("ko-KR")}
          <span className="sr-only">개 좋아요</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <BubbleIcon className="h-4 w-4" />
          {post.comment_count.toLocaleString("ko-KR")}
          <span className="sr-only">개 댓글</span>
        </span>
      </footer>
    </article>
  );
}

/** 밈 첨부 미니 카드 — 밈 상세로 이동하는 보조 링크 */
export function CommunityMemeChip({
  meme,
  className = "",
}: {
  meme: CommunityMemeMini;
  className?: string;
}) {
  return (
    <Link
      href={memePathFrom(meme.short_id, meme.slug)}
      className={`flex min-h-11 items-center gap-2.5 rounded-xl border border-border bg-surface-2 px-3 py-2 transition-colors hover:border-accent ${className}`}
    >
      <CategoryTag category={meme.category} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold">{meme.title}</span>
        <span className="block truncate text-xs text-muted">{meme.summary}</span>
      </span>
      <ChevronIcon className="h-4 w-4 shrink-0 text-muted" />
    </Link>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20.5S4 15.5 4 9.8A4.3 4.3 0 0 1 8.3 5.5c1.6 0 3 .9 3.7 2.1a4.3 4.3 0 0 1 3.7-2.1A4.3 4.3 0 0 1 20 9.8c0 5.7-8 10.7-8 10.7Z" />
    </svg>
  );
}

function BubbleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15.5H10l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 14V7A1.5 1.5 0 0 1 5 5.5Z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}
