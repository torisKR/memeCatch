export default function SubmitLoading() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-8" aria-busy>
      <span className="sr-only">불러오는 중이에요</span>
      <div className="h-8 w-36 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-2 h-5 w-full animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-6 flex flex-col gap-5">
        <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-28 animate-pulse rounded-xl bg-surface-2" />
        <div className="h-12 animate-pulse rounded-xl bg-surface-2" />
      </div>
    </main>
  );
}
