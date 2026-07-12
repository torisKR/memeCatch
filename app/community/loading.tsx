/** 레인 3 — 커뮤니티 목록 스켈레톤 */
export default function CommunityLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-14 pt-6" aria-busy>
      <div className="h-8 w-32 rounded-lg shimmer" />
      <div className="mt-2 h-5 w-64 rounded-lg shimmer" />
      <ul className="mt-5 space-y-3" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="rounded-2xl border border-border bg-surface p-4">
            <div className="h-4 w-28 rounded shimmer" />
            <div className="mt-2.5 h-5 w-3/4 rounded shimmer" />
            <div className="mt-2 h-4 w-full rounded shimmer" />
            <div className="mt-1.5 h-4 w-2/3 rounded shimmer" />
          </li>
        ))}
      </ul>
    </main>
  );
}
