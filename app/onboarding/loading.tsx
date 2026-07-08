export default function OnboardingLoading() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-10" aria-busy>
      <span className="sr-only">불러오는 중이에요</span>
      <div className="h-8 w-20 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-4 h-9 w-64 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-2 h-5 w-full animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-8 h-12 animate-pulse rounded-xl bg-surface-2" />
      <div className="mt-8 h-6 w-56 animate-pulse rounded-lg bg-surface-2" />
      <div className="mt-3 flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-11 w-20 animate-pulse rounded-full bg-surface-2" />
        ))}
      </div>
      <div className="mt-8 h-12 animate-pulse rounded-xl bg-surface-2" />
    </main>
  );
}
