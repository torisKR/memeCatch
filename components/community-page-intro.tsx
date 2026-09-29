import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CatchMascot } from "@/components/catch-mascot";

export function CommunityPageIntro() {
  return (
    <section
      aria-labelledby="community-title"
      className="relative isolate overflow-hidden rounded-3xl border border-border bg-surface-2 px-5 py-6 sm:px-8 sm:py-8"
    >
      <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 id="community-title" className="text-3xl font-black tracking-tight sm:text-4xl">
              커뮤니티
            </h1>
            <span className="inline-flex min-h-6 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 text-xs font-bold text-accent-text">
              <span aria-hidden className="signal-live size-1.5 rounded-full bg-(--signal-cyan)" />
              베타
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            밈을 추천하고, 처음 본 맥락을 함께 남겨요.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href="/community/new"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-accent-strong px-4 text-sm font-bold text-white transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
            >
              글쓰기 <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Link
              href="/explore?sort=recent"
              className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              최신 밈 보기
            </Link>
            <Link
              href="/products"
              className="inline-flex min-h-11 items-center rounded-xl border border-border bg-surface px-3 text-sm font-semibold transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              밈 상품
            </Link>
          </div>
        </div>

        <div
          aria-hidden
          className="hidden h-32 w-40 shrink-0 place-items-center overflow-hidden rounded-2xl bg-ink sm:grid lg:h-36 lg:w-44"
        >
          <CatchMascot size="sm" state="help" />
        </div>
      </div>
    </section>
  );
}
