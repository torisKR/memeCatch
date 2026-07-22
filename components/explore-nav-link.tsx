"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";

/**
 * 데스크톱 헤더 주 동선 링크 — "탐색"(/explore) 하나만 상시 노출.
 * 연표·커뮤니티는 2026-07 헤더 IA 개편으로 우측 통합 메뉴(<HeaderMenu/>)로
 * 이동했다. 모바일은 BottomNav가 탐색·커뮤니티 탭을 담당해 md 이상만 노출.
 * layout은 클라이언트 탐색에서 재사용되므로 최신 경로는 usePathname으로 읽고,
 * 이동 대기 상태는 useLinkStatus 스피너로 표시한다(바텀내비와 동일 신호).
 */
export function ExploreNavLink() {
  const { messages } = useLocale();
  const pathname = usePathname();
  const active = pathname.startsWith("/explore");
  return (
    <Link
      href="/explore"
      aria-current={active ? "page" : undefined}
      className={`no-press hidden h-11 items-center gap-1.5 rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex ${
        active
          ? "bg-surface-2 font-semibold text-foreground"
          : "font-medium text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <HeaderNavInner icon={CompassIcon} label={messages.explore} active={active} />
    </Link>
  );
}

// <Link> 자식에서 useLinkStatus로 이 링크의 이동 대기 상태를 읽어,
// 대기 중이면 아이콘 자리에 스피너를 띄운다(바텀내비와 동일한 신호).
function HeaderNavInner({
  icon: Icon,
  label,
  active,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  label: string;
  active: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <>
      {pending ? (
        <svg
          className="h-4 w-4 animate-spin motion-reduce:animate-none text-accent"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeOpacity="0.25"
          />
          <path
            d="M21 12a9 9 0 0 0-9-9"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <Icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
      )}
      {label}
    </>
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
