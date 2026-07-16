import { MemeGridSkeleton, MemeStripSkeleton, SkeletonBone } from "@/components/skeletons";

export default function HomeLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-12">
      <div className="pb-8 pt-10 md:pt-16">
        <SkeletonBone className="h-8 w-2/3" />
        <SkeletonBone className="mt-2 h-5 w-1/2" />
        <SkeletonBone className="mt-5 h-14 w-full rounded-2xl" />
      </div>
      <SkeletonBone className="h-6 w-36" />
      <div className="mt-3">
        <MemeStripSkeleton />
      </div>
      <SkeletonBone className="mt-8 h-6 w-48" />
      <div className="mt-3">
        <MemeGridSkeleton count={4} />
      </div>
    </main>
  );
}
