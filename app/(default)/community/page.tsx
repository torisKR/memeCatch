import type { Metadata } from "next";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createStaticClient } from "@/lib/supabase/server";
import { CommunityPostCard } from "@/components/community-post-card";
import { CommunityPageIntro } from "@/components/community-page-intro";
import { StatusPanel } from "@/components/status-panel";
import { CatchMascot } from "@/components/catch-mascot";
import {
  POSTS_PAGE_SIZE,
  POST_SELECT,
  type CommunityPostRow,
} from "./shared";

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
      <CommunityPageIntro />

      {failed && (
        <StatusPanel
          className="mt-6"
          role="alert"
          tone="error"
          label="연결 신호 확인 중"
          title="글을 불러오지 못했어요"
          description="연결이 잠시 끊겼어요. 다시 시도하거나 먼저 글을 남겨 주세요."
          actions={
            <>
              <Link
                href="/community"
                className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                다시 불러오기
              </Link>
              <Link
                href="/community/new"
                className="inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
              >
                글쓰기
              </Link>
              <Link
                href="/explore?sort=recent"
                className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                최신 밈 보기
              </Link>
            </>
          }
        />
      )}

      {!failed && visible.length === 0 && (
        <section
          role="status"
          aria-labelledby="community-empty-title"
          className="relative mt-5 grid overflow-hidden rounded-3xl border border-border bg-surface sm:grid-cols-[minmax(0,1fr)_13rem]"
        >
          <div className="px-5 py-7 sm:px-8 sm:py-9">
            <p className="text-sm font-bold text-accent-text">첫 이야기를 기다리고 있어요</p>
            <h2 id="community-empty-title" className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">
              아직 글이 없어요
            </h2>
            <p className="mt-2 max-w-xl text-base leading-relaxed text-muted">
              요즘 눈에 띈 밈이나 기억나는 장면을 남기고 대화를 시작해 보세요.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/community/new"
                className="inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
              >
                첫 글 쓰기
              </Link>
              <Link
                href="/explore?sort=recent"
                className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                최신 밈 둘러보기
              </Link>
            </div>
          </div>
          <div aria-hidden className="hidden place-items-center bg-ink sm:grid">
            <CatchMascot size="sm" state="help" />
          </div>
        </section>
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
