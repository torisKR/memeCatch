"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "대시보드", icon: GaugeIcon },
  { href: "/admin/submissions", label: "제보 큐", icon: InboxIcon },
  { href: "/admin/sources", label: "출처 검수", icon: LinkIcon },
  { href: "/admin/radar-safety", label: "Radar 안전", icon: FlagIcon },
  { href: "/admin/memes", label: "밈 관리", icon: BookIcon },
  { href: "/admin/reports", label: "신고", icon: FlagIcon },
  { href: "/admin/users", label: "사용자 관리", icon: UsersIcon },
  { href: "/admin/subscriptions", label: "구독 관리", icon: StarIcon },
  { href: "/admin/inquiries", label: "문의 관리", icon: ChatIcon },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="관리자 메뉴" className="overflow-x-auto md:flex-1 md:overflow-visible">
      <ul className="flex gap-1 px-2 pb-2 md:flex-col md:pb-0">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-base ${
                  active
                    ? "bg-accent-soft font-semibold text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="shrink-0 md:mt-auto md:pt-4">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-base text-muted hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            사이트로 돌아가기
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function GaugeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 14a8 8 0 1 1 16 0" strokeLinecap="round" />
      <path d="M12 14l4-4" strokeLinecap="round" />
    </svg>
  );
}
function InboxIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 5h16v14H4z M4 14h5l1.5 2h3L15 14h5" strokeLinejoin="round" />
    </svg>
  );
}
function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M19 16H8a3 3 0 0 0-3 3" strokeLinejoin="round" />
    </svg>
  );
}
function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function FlagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 21V4m0 1h12l-3 4 3 4H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m12 3 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9 6.7 19.6l1-5.8L3.5 9.7l5.9-.9L12 3Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeLinecap="round" />
    </svg>
  );
}
function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M19 12H5m6-6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="8" r="3.2" />
      <path d="M20 19v-1.4a3.2 3.2 0 0 0-2.4-3.1M15.5 5.2a3.2 3.2 0 0 1 0 5.6" strokeLinecap="round" />
    </svg>
  );
}
