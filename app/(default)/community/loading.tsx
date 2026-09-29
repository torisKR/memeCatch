import { CommunityPageIntro } from "@/components/community-page-intro";

/** 커뮤니티 소개와 글쓰기 동선은 유지하면서 목록만 스켈레톤으로 대체한다. */
export default function CommunityLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-6" aria-busy="true">
      <CommunityPageIntro />
      <p role="status" className="sr-only">
        커뮤니티 글을 불러오는 중
      </p>
      <ul className="mt-5 space-y-3" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <li key={i} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <div className="h-4 w-32 rounded shimmer" />
            <div className="mt-3 h-6 w-3/4 rounded shimmer" />
            <div className="mt-3 h-4 w-full rounded shimmer" />
            <div className="mt-2 h-4 w-2/3 rounded shimmer" />
          </li>
        ))}
      </ul>
    </main>
  );
}
