"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";

/**
 * 데스크톱 헤더 내비 링크 — "탐색"(/explore) + "커뮤니티"(/community, 레인 3 추가).
 * layout은 클라이언트 탐색에서 재사용되므로 최신 경로는 usePathname으로 읽는다.
 * GlobalHeader가 <ExploreNavLink/> 하나만 렌더하므로 커뮤니티 링크도 여기서 함께
 * 렌더한다(헤더 파일은 다른 레인 소유).
 * 모바일은 BottomNav에 두 탭이 있어 md 이상에서만 노출.
 */
export function ExploreNavLink() {
  const { messages } = useLocale();
  return (
    <>
      <HeaderNavLink href="/explore" label={messages.explore} icon={CompassIcon} />
      <HeaderNavLink href="/timeline" label={messages.timeline} icon={TimelineIcon} />
      <HeaderNavLink href="/community" label={messages.community} icon={ChatIcon} />
    </>
  );
}

function HeaderNavLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.ReactElement;
}) {
  const pathname = usePathname();
  const active = pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`hidden h-11 items-center gap-1.5 rounded-full px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex ${
        active
          ? "bg-surface-2 font-semibold text-foreground"
          : "font-medium text-muted hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 ${active ? "text-accent" : ""}`} />
      {label}
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

function TimelineIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 12h16" />
      <circle cx="7" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path
        d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15.5H10l-4 3.5v-3.5H5A1.5 1.5 0 0 1 3.5 14V7A1.5 1.5 0 0 1 5 5.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
