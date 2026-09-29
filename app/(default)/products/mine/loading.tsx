export default function Loading() {
  return <main aria-busy="true" aria-label="등록한 상품 불러오는 중" className="mx-auto max-w-4xl space-y-4 px-4 py-8">
    <div className="h-8 w-56 motion-safe:animate-pulse rounded bg-surface-2" />
    {[1, 2].map((item) => <div key={item} className="h-36 motion-safe:animate-pulse rounded-2xl border border-border bg-surface-2" />)}
  </main>;
}
