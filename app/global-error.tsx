"use client";

import RootError from "@/app/(default)/error";
import "./globals.css";

/** Last-resort boundary for failures thrown by either root layout itself. */
export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
}) {
  return (
    <html lang="ko" dir="ltr">
      <body className="theme-ink min-h-dvh bg-background text-foreground">
        <title>오류가 발생했어요 | 밈캐치</title>
        <RootError
          error={error}
          reset={reset}
          unstable_retry={unstable_retry}
        />
      </body>
    </html>
  );
}
