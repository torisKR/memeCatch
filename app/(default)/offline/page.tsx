import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "오프라인",
  description: "네트워크 연결이 끊겨 있어요. 연결 후 다시 시도해 주세요.",
  robots: { index: false, follow: false },
};

/**
 * 오프라인 폴백 — 서비스 워커(app/sw.ts)의 fallbacks 설정이
 * 내비게이션 실패 시 이 페이지의 precache 사본을 보여준다.
 * 외부 리소스 없이 렌더되도록 정적·자급자족으로 유지할 것.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-5xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface px-6 py-10 shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
          {/* wifi-off 아이콘 (인라인 SVG — 오프라인에서도 항상 렌더) */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
            <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
            <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
            <path d="M5 13a10 10 0 0 1 5.24-2.76" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
          지금은 오프라인이에요
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted">
          네트워크 연결이 끊겨 페이지를 불러오지 못했어요. 연결 상태를 확인한
          뒤 다시 시도해 주세요.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
            폴백 화면에서는 <Link>의 클라이언트 라우팅(RSC fetch)이 오프라인에서
            실패한다. 풀 내비게이션이어야 재연결 시 정상 로드, 실패 시 SW 폴백이
            다시 동작한다. */}
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-accent-soft px-5 py-2.5 text-sm font-semibold text-accent"
        >
          다시 시도하기
        </a>
      </div>
    </main>
  );
}
