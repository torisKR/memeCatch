/** 레인 3 — 커뮤니티 글쓰기 폼 스켈레톤 */
export default function CommunityNewLoading() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-8" aria-busy>
      <div className="h-8 w-40 rounded-lg shimmer" aria-hidden />
      <div className="mt-2 h-5 w-full rounded shimmer" aria-hidden />
      <div className="mt-1.5 h-5 w-2/3 rounded shimmer" aria-hidden />

      <div className="mt-6 space-y-4" aria-hidden>
        <div className="h-11 w-full rounded-xl shimmer" />
        <div className="h-32 w-full rounded-xl shimmer" />
        <div className="h-11 w-full rounded-xl shimmer" />
        <div className="h-11 w-28 rounded-full shimmer" />
      </div>
    </main>
  );
}
