import { SkeletonBone } from "@/components/skeletons";

export default function ProductsLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8" aria-busy="true">
      <SkeletonBone className="h-4 w-28" />
      <SkeletonBone className="mt-3 h-10 w-48" />
      <SkeletonBone className="mt-3 h-6 w-full max-w-2xl" />
      <SkeletonBone className="mt-6 h-24 w-full rounded-2xl" />
      <SkeletonBone className="mt-10 h-4 w-36" />
      <SkeletonBone className="mt-6 h-8 w-44" />
      <SkeletonBone className="mt-2 h-5 w-full max-w-xl" />
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <SkeletonBone key={index} className="aspect-[3/4] rounded-2xl" />
        ))}
      </div>
      <SkeletonBone className="mt-14 h-8 w-56" />
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonBone key={index} className="h-80 rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
