import type { Metadata } from "next";
import Link from "next/link";

/**
 * Rankings-only 404. The meme dictionary not-found page stays on its own route.
 * Next 16 can answer notFound() with HTTP 200, so robots are set here as well.
 */
export const metadata: Metadata = {
  title: "랭킹을 잠시 볼 수 없어요",
  robots: { index: false, follow: true },
};

export default function RankingsNotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-border bg-surface-2 px-6 py-10 text-center sm:px-10 sm:py-12">
        <h1 className="text-2xl font-extrabold tracking-tight">
          랭킹을 잠시 볼 수 없어요
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          순위를 다시 정리하고 있어요. 그동안 밈 사전에서 찾아보세요.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/explore"
            className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-base font-bold text-white"
          >
            밈 사전 보기
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-6 text-base font-semibold"
          >
            홈으로
          </Link>
        </div>
      </div>
    </main>
  );
}
