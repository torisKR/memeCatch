"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-60 flex-col items-center justify-center gap-4 rounded-xl border border-border bg-surface p-8 text-center">
      <p className="text-lg font-semibold">문제가 발생했어요</p>
      <p className="text-base text-muted">
        {error.message || "데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="min-h-11 rounded-lg bg-accent-strong px-5 text-base font-semibold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
