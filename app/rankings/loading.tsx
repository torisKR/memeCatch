/** 랭킹 로딩 스켈레톤 */
export default function RankingsLoading() {
  return (
    <main className="mx-auto max-w-lg px-4 py-6" aria-busy>
      <div className="h-8 w-24 rounded-lg shimmer" />
      <div className="mt-2 h-5 w-56 rounded-lg shimmer" />
      <div className="mt-6 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-11 flex-1 rounded-full shimmer" />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 rounded-2xl shimmer" />
        ))}
      </div>
      <p className="sr-only">랭킹을 불러오고 있어요</p>
    </main>
  );
}
