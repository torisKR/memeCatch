export default function Loading() {
  return <main aria-busy="true" aria-label="검토 대기 상품 불러오는 중" className="space-y-4">
    <div className="h-8 w-64 motion-safe:animate-pulse rounded bg-surface-2" />
    {[1, 2].map((item) => <div key={item} className="h-64 motion-safe:animate-pulse rounded-2xl border border-border bg-surface-2" />)}
  </main>;
}
