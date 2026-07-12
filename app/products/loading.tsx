import { SkeletonBone } from "@/components/skeletons";

export default function ProductsLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8" aria-busy="true">
      <SkeletonBone className="h-4 w-28" />
      <SkeletonBone className="mt-3 h-10 w-48" />
      <SkeletonBone className="mt-3 h-6 w-full max-w-2xl" />
      <SkeletonBone className="mt-6 h-24 w-full rounded-2xl" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonBone key={index} className="h-80 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
