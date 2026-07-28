import { Skeleton } from "@/components/ui/skeleton";

export default function ProductsLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8" aria-busy="true">
      <Skeleton className="h-56 w-full max-w-4xl rounded-[1.75rem] border-2 border-border" />
      <Skeleton className="mt-7 h-24 w-full rounded-lg border-2 border-border" />
      <Skeleton className="mt-10 h-8 w-56" />
      <Skeleton className="mt-2 h-5 w-full max-w-xl" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton
            key={index}
            className={`aspect-[3/4] rounded-xl border-2 border-border ${
              index === 1 ? "hidden sm:block" : index === 2 ? "hidden lg:block" : ""
            }`}
          />
        ))}
      </div>
    </main>
  );
}
