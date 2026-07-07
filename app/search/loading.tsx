import { SearchResultsSkeleton, SkeletonBone } from "@/components/skeletons";

export default function SearchLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-14 pt-6">
      <SkeletonBone className="h-14 w-full rounded-2xl" />
      <div className="mt-6">
        <SearchResultsSkeleton />
      </div>
    </main>
  );
}
