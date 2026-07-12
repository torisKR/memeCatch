/** 레인 3 — 커뮤니티 글 상세 스켈레톤 */
export default function CommunityPostLoading() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-14 pt-6" aria-busy>
      <div className="h-5 w-24 rounded shimmer" aria-hidden />

      <article className="rounded-2xl border border-border bg-surface p-5" aria-hidden>
        <header>
          <div className="h-7 w-3/4 rounded-lg shimmer" />
          <div className="mt-3 flex items-center gap-2">
            <div className="h-4 w-20 rounded shimmer" />
            <div className="h-4 w-16 rounded shimmer" />
          </div>
        </header>

        <div className="mt-4 space-y-2">
          <div className="h-4 w-full rounded shimmer" />
          <div className="h-4 w-full rounded shimmer" />
          <div className="h-4 w-5/6 rounded shimmer" />
          <div className="h-4 w-2/3 rounded shimmer" />
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <div className="h-9 w-24 rounded-full shimmer" />
        </div>
      </article>

      <section aria-hidden className="space-y-4">
        <div className="h-6 w-20 rounded shimmer" />
        <div className="h-24 w-full rounded-xl shimmer" />

        <ul className="space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="rounded-xl bg-surface-2 p-4">
              <div className="flex items-center gap-2">
                <div className="h-4 w-16 rounded shimmer" />
                <div className="h-4 w-12 rounded shimmer" />
              </div>
              <div className="mt-2 h-4 w-full rounded shimmer" />
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
