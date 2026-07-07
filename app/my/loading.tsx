export default function MyLoading() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-8" aria-busy>
      <span className="sr-only">불러오는 중이에요</span>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-20 animate-pulse rounded-lg bg-surface-2" />
          <div className="h-5 w-40 animate-pulse rounded-lg bg-surface-2" />
        </div>
        <div className="h-11 w-24 animate-pulse rounded-xl bg-surface-2" />
      </div>
      <div className="mt-6 h-32 animate-pulse rounded-2xl bg-surface-2" />
      <div className="mt-8 h-6 w-24 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      </div>
      <div className="mt-8 h-6 w-24 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    </main>
  );
}
