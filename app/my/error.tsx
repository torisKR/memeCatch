"use client";

export default function MyError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-16 text-center">
      <h1 className="text-xl font-bold">MY를 불러오지 못했어요</h1>
      <p className="mt-2 text-muted">잠시 후 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-12 rounded-xl bg-accent-strong px-6 text-base font-bold text-white"
      >
        다시 시도
      </button>
    </main>
  );
}
