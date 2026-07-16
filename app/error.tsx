"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * 루트 에러 바운더리 — 예기치 못한 런타임 오류의 폴백 UI.
 * StatusPanel의 신호등 언어(빨간 신호)를 잇는 간결한 카드 + 다시 시도 + 홈 링크.
 * Next 16.2+의 unstable_retry(재페치 후 재렌더)를 우선 사용하고 reset으로 폴백.
 */
export default function RootError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-14 sm:py-20">
      <div className="mx-auto w-full max-w-2xl">
        <div
          role="alert"
          className="relative overflow-hidden rounded-3xl border border-border bg-surface-2 px-6 py-10 text-center sm:px-10 sm:py-12"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--safety-red) 10%, transparent), transparent 52%)",
          }}
        >
          <div className="relative mx-auto max-w-md">
            <p className="inline-flex min-h-8 items-center gap-2 rounded-full bg-ink px-3 text-xs font-semibold text-white">
              <span aria-hidden className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-safety-red" />
              </span>
              신호 오류
            </p>

            <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
              밈을 잡다가 놓쳤어요
            </h1>
            <p className="mt-2 text-base text-muted">
              일시적인 오류예요. 다시 시도하면 대부분 해결돼요.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => (unstable_retry ?? reset)()}
                className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-6 text-sm font-bold text-white transition-transform active:scale-[0.97]"
              >
                다시 시도
              </button>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-2"
              >
                홈으로
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
