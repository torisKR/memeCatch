export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-6" aria-busy="true">
      <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
      <div className="mt-3 h-8 w-48 animate-pulse rounded bg-surface-2" />
      <div className="mt-2 h-5 w-72 max-w-full animate-pulse rounded bg-surface-2" />
      <div className="mt-5 h-14 animate-pulse rounded-2xl bg-surface-2" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="aspect-[4/3] animate-pulse rounded-[16px] bg-[#141414]" />
        ))}
      </div>
    </main>
  );
}
