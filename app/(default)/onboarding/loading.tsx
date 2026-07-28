export default function OnboardingLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10" aria-busy>
      <div className="mx-auto w-full max-w-md">
        <span className="sr-only">불러오는 중이에요</span>
        <div className="h-8 w-20 rounded-lg shimmer" />
        <div className="mt-4 h-9 w-64 rounded-lg shimmer" />
        <div className="mt-2 h-5 w-full rounded-lg shimmer" />
        <div className="mt-8 h-12 rounded-xl shimmer" />
        <div className="mt-8 h-6 w-56 rounded-lg shimmer" />
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 w-20 rounded-full shimmer" />
          ))}
        </div>
        <div className="mt-8 h-12 rounded-xl shimmer" />
      </div>
    </main>
  );
}
