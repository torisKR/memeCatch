import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStaticClient } from "@/lib/supabase/server";
import { CommunityPostCard } from "@/components/community-post-card";
import { StatusPanel } from "@/components/status-panel";
import {
  POSTS_PAGE_SIZE,
  POST_SELECT,
  type CommunityPostRow,
} from "./shared";
import { AdsenseScript } from "@/components/adsense-script";

/**
 * 레인 3 — 커뮤니티 글 목록 (최신순, 서버 컴포넌트 + 페이지네이션).
 * searchParams(page) 사용 → 동적 렌더. 쿠키 미사용(createStaticClient).
 * community_posts는 database.types.ts에 아직 없어 무타입 캐스팅.
 * // TODO: types regen 후 정리
 */

const COMMUNITY_DESCRIPTION =
  "밈 추천·추억·토론 — 밈캐치 사람들과 자유롭게 이야기해요.";

export const metadata: Metadata = {
  title: "커뮤니티",
  description: COMMUNITY_DESCRIPTION,
  // 루트 canonical("/") 상속 방지 — ?page= 쿼리 변형은 기본 경로로 수렴
  alternates: { canonical: "/community" },
  // Next metadata는 title을 openGraph로 자동 전파하지 않음 — 페이지별 og 명시
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
    title: "커뮤니티",
    description: COMMUNITY_DESCRIPTION,
    url: "/community",
  },
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const rawPage = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const page = Math.max(1, Number.parseInt(rawPage ?? "1", 10) || 1);
  const from = (page - 1) * POSTS_PAGE_SIZE;

  let posts: CommunityPostRow[] = [];
  let failed = false;
  try {
    const supabase = createStaticClient() as unknown as SupabaseClient;
    const { data, error } = await supabase
      .from("community_posts")
      .select(POST_SELECT)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      // +1로 다음 페이지 존재 여부 판별
      .range(from, from + POSTS_PAGE_SIZE);
    if (error) failed = true;
    else posts = (data ?? []) as unknown as CommunityPostRow[];
  } catch {
    failed = true;
  }

  const hasNext = posts.length > POSTS_PAGE_SIZE;
  const visible = hasNext ? posts.slice(0, POSTS_PAGE_SIZE) : posts;

  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-6">
      <AdsenseScript />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">커뮤니티</h1>
            {/* 이제 막 시작한 공간임을 정직하게 표시 */}
            <span className="hover-glow-flame inline-flex items-center gap-1.5 rounded-full border border-transparent bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">
              <span aria-hidden className="signal-live size-1.5 rounded-full bg-(--signal-cyan)" />
              베타
            </span>
          </div>
          <p className="mt-1 text-base text-muted">
            밈 추천·추억·토론 — 뭐든 편하게 이야기해요.
          </p>
        </div>
        <Link
          href="/community/new"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent-strong px-5 text-base font-bold text-white transition-transform active:scale-[0.97]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
          글쓰기
        </Link>
      </div>

      {failed && (
        <StatusPanel
          className="mt-6"
          role="alert"
          tone="error"
          label="연결 신호 확인 중"
          title="글을 불러오지 못했어요"
          description="연결이 잠시 끊겼어요. 바로 다시 불러올 수 있어요."
          actions={
            <Link
              href="/community"
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold transition-colors hover:border-accent hover:text-accent"
            >
              다시 불러오기
            </Link>
          }
        />
      )}

      {!failed && visible.length === 0 && (
        <StatusPanel
          className="mt-6"
          role="status"
          label="첫 신호 대기 중"
          title="아직 글이 없어요"
          description="첫 글을 남기고 밈 이야기를 시작해 보세요."
          actions={
            <Link
              href="/community/new"
              className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-base font-bold text-white transition-transform active:scale-[0.97]"
            >
              첫 글 쓰러 가기
            </Link>
          }
        />
      )}

      <ul className="instrument-grid mt-5 space-y-3">
        {visible.map((post) => (
          <li key={post.id}>
            <CommunityPostCard post={post} />
          </li>
        ))}
      </ul>

      {/* 페이지네이션 */}
      {(page > 1 || hasNext) && (
        <nav aria-label="페이지 이동" className="mt-6 flex items-center justify-between">
          {page > 1 ? (
            <Link
              href={page === 2 ? "/community" : `/community?page=${page - 1}`}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold"
            >
              이전
            </Link>
          ) : (
            <span />
          )}
          {hasNext && (
            <Link
              href={`/community?page=${page + 1}`}
              className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-base font-semibold"
            >
              더 보기
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
