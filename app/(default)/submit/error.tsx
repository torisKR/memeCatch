"use client";

import { useLocale } from "@/lib/i18n-client";
import { SUBMIT_COPY } from "@/lib/i18n-submit";

export default function SubmitError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const { locale } = useLocale();
  const copy = SUBMIT_COPY[locale].page;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-16 text-center">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-xl font-bold">{copy.loadErrorTitle}</h1>
        <p className="mt-2 text-muted">{copy.loadErrorBody}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 h-12 rounded-xl bg-accent-strong px-6 text-base font-bold text-white"
        >
          {copy.retry}
        </button>
      </div>
    </main>
  );
}
