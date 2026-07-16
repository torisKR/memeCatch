import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CommunityPostForm } from "@/components/community-post-form";

/**
 * 레인 3 — 커뮤니티 글쓰기.
 * 비로그인 → /login?next=/community/new (기존 로그인 유도 패턴).
 * 쿠키 조회로 동적 렌더 — 글쓰기 페이지라 캐시 불필요.
 */

export const metadata: Metadata = {
  title: "커뮤니티 글쓰기",
  description: "밈 추천·추억·토론 — 커뮤니티에 새 글을 올려요.",
};

export default async function CommunityNewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/community/new");

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-2xl font-bold">커뮤니티 글쓰기</h1>
        <p className="mt-2 text-muted">
          밈 추천, 추억, 토론 — 뭐든 편하게 써 주세요. 밈을 첨부하면 함께 보여드려요.
        </p>
        <div className="mt-6">
          <CommunityPostForm />
        </div>
      </div>
    </main>
  );
}
