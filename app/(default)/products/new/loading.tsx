export default function Loading() {
  return <main aria-busy="true" aria-label="상품 등록 양식 불러오는 중" className="mx-auto max-w-3xl px-4 py-8">
    <div className="h-8 w-48 motion-safe:animate-pulse rounded bg-surface-2" />
    <div className="mt-6 h-[620px] motion-safe:animate-pulse rounded-2xl border border-border bg-surface-2" />
  </main>;
}
