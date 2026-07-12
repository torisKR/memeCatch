import { SkeletonBone } from "@/components/skeletons";

export default function NewsLoading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-14 pt-8" aria-busy="true">
      <SkeletonBone className="h-4 w-32" />
      <SkeletonBone className="mt-3 h-10 w-56" />
      <SkeletonBone className="mt-3 h-6 w-full max-w-2xl" />
      {Array.from({ length: 3 }, (_, section) => (
        <section key={section} className="mt-10">
          <SkeletonBone className="h-8 w-64" />
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, card) => (
              <SkeletonBone key={card} className="h-72 rounded-2xl" />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
