"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";
import { localizedStaticPath } from "@/lib/i18n-routing";

const TABS: {
  href: string;
  label: "brand" | "explore" | "submit" | "premium" | "my";
  icon: (props: { className?: string }) => React.ReactElement;
  emphasized?: boolean;
}[] = [
  { href: "/", label: "brand", icon: HomeIcon },
  { href: "/explore", label: "explore", icon: CompassIcon },
  { href: "/submit", label: "submit", icon: PlusIcon, emphasized: true },
  { href: "/premium", label: "premium", icon: PremiumIcon },
  { href: "/my", label: "my", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();
  const { locale, messages } = useLocale();
  if (pathname.startsWith("/admin")) return null;

  return (
    <nav
      aria-label={messages.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-(--foreground)/10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-(--surface)/72 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const href =
            tab.label === "brand" || tab.label === "explore"
              ? localizedStaticPath(tab.href, locale)
              : tab.href;
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`no-press flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  tab.emphasized
                    ? "text-accent-strong font-semibold"
                    : active
                      ? "text-flame-400 font-semibold"
                      : "text-muted"
                }`}
              >
                <TabInner
                  icon={tab.icon}
                  emphasized={tab.emphasized}
                  active={active}
                  label={
                    tab.label === "premium"
                      ? "Plus"
                      : tab.href === "/"
                      ? ({ ko: "홈", ja: "ホーム", zh: "首页", "zh-tw": "首頁" } as Partial<Record<typeof locale, string>>)[locale] ?? "Home"
                      : messages[tab.label]
                  }
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// 탭 내부 — <Link> 자식이라 useLinkStatus()로 이 탭의 이동 대기 상태를 읽는다.
// 대기 중이면 아이콘 자리에 스피너를 띄워 "어느 탭을 눌렀는지"를 즉시 보여준다.
function TabInner({
  icon: Icon,
  emphasized,
  active,
  label,
}: {
  icon: (props: { className?: string }) => React.ReactElement;
  emphasized?: boolean;
  active?: boolean;
  label: string;
}) {
  const { pending } = useLinkStatus();
  const iconWrap = `h-5 w-5 ${
    emphasized
      ? "rounded-full bg-accent-soft p-0.5 shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_50%,transparent),0_0_10px_1px_color-mix(in_srgb,var(--flame-500)_55%,transparent)]"
      : ""
  }`;

  return (
    <>
      <span className="relative grid h-5 w-5 place-items-center">
        {active && !emphasized ? (
          <span
            aria-hidden
            className="signal-live absolute -top-0.5 right-0 size-1.5 rounded-full bg-(--signal-cyan)"
          />
        ) : null}
        {pending ? (
          <svg
            className="h-5 w-5 animate-spin motion-reduce:animate-none"
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
          <Icon className={iconWrap} />
        )}
      </span>
      <span
        className={pending ? "text-accent-strong transition-colors" : undefined}
      >
        {label}
      </span>
    </>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V21H3z" strokeLinejoin="round" />
    </svg>
  );
}
function CompassIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" strokeLinejoin="round" />
    </svg>
  );
}
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function PremiumIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m12 3 2.4 5.1L20 9l-4 4.1.9 5.9-4.9-2.7L7.1 19l.9-5.9L4 9l5.6-.9L12 3Z" strokeLinejoin="round" />
    </svg>
  );
}
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 5-5.5 8-5.5s6.5 1.5 8 5.5" strokeLinecap="round" />
    </svg>
  );
}
