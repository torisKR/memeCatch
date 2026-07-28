export default function MyLoading() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy>
      <span className="sr-only">불러오는 중이에요</span>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-20 rounded-lg shimmer" />
          <div className="h-5 w-40 rounded-lg shimmer" />
        </div>
        <div className="h-11 w-24 rounded-xl shimmer" />
      </div>
      <div className="mt-6 h-32 rounded-2xl shimmer" />
      <div className="mt-8 h-6 w-24 rounded-lg shimmer" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="h-24 rounded-2xl shimmer" />
        <div className="h-24 rounded-2xl shimmer" />
      </div>
      <div className="mt-8 h-6 w-24 rounded-lg shimmer" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="h-24 rounded-2xl shimmer" />
        <div className="h-24 rounded-2xl shimmer" />
      </div>
    </main>
  );
}
