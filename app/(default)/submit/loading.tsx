"use client";

import { useLocale } from "@/lib/i18n-client";
import { SUBMIT_COPY } from "@/lib/i18n-submit";

export default function SubmitLoading() {
  const { locale } = useLocale();
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8" aria-busy>
      <div className="mx-auto w-full max-w-md">
        <span className="sr-only">{SUBMIT_COPY[locale].page.loading}</span>
        <div className="h-8 w-36 rounded-lg shimmer" />
        <div className="mt-2 h-5 w-full rounded-lg shimmer" />
        <div className="mt-6 flex flex-col gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={
                i === 3 ? "h-28 rounded-xl shimmer" : "h-12 rounded-xl shimmer"
              }
            />
          ))}
        </div>
      </div>
    </main>
  );
}
