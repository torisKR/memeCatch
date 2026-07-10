"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * 데스크톱 헤더 "탐색" 링크 — /explore 진입 + 현재 경로 active 표시.
 * 클라이언트 usePathname만 사용(서버 쿠키 조회 없음 → ISR/dynamic 강등 회피).
 * GlobalHeader를 정적 서버 컴포넌트로 유지하기 위해 AuthMenu/HideOnAdmin과
 * 동일하게 클라이언트 헬퍼로 분리했다.
 * 모바일은 BottomNav에 탐색 탭이 있어 md 이상에서만 노출.
 */
export function ExploreNavLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/explore");
  return (
    <Link
      href="/explore"
      aria-current={active ? "page" : undefined}
      className={`hidden h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex ${
        active
          ? "bg-surface-2 font-semibold text-foreground"
          : "font-medium text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <CompassIcon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
      탐색
    </Link>
  );
}

function CompassIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" strokeLinejoin="round" />
    </svg>
  );
}
