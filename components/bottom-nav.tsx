"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";
import { localizedStaticPath, stripLocalePath } from "@/lib/i18n-routing";
import { normalizePathname } from "@/lib/normalize-pathname";

const TABS: {
  href: string;
  label: "brand" | "latest" | "community" | "submit" | "my";
  icon: (props: { className?: string }) => React.ReactElement;
  emphasized?: boolean;
}[] = [
  { href: "/", label: "brand", icon: HomeIcon },
  { href: "/explore?sort=recent", label: "latest", icon: CompassIcon },
  { href: "/community", label: "community", icon: CommunityIcon },
  { href: "/submit", label: "submit", icon: PlusIcon, emphasized: true },
  { href: "/my", label: "my", icon: UserIcon },
];

export function BottomNav() {
  const pathname = normalizePathname(usePathname());
  const { locale, messages } = useLocale();
  if (pathname.startsWith("/admin")) return null;
  const currentPath = stripLocalePath(pathname);

  return (
    <nav
      aria-label={messages.mainNav}
      data-site-bottom-nav=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-(--foreground)/10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-(--surface)/72 md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex min-w-[19.25rem] max-w-2xl items-stretch justify-around">
        {TABS.map((tab) => {
          const href =
            tab.label === "brand" || tab.label === "latest"
              ? localizedStaticPath(tab.href, locale)
              : tab.href;
          const targetPath = stripLocalePath(href).split("?")[0];
          const active =
            tab.label === "brand"
              ? currentPath === "/" || currentPath === "/index"
              : currentPath === targetPath ||
                currentPath.startsWith(`${targetPath}/`);
          return (
            <li key={tab.href} className="flex min-w-11 flex-1">
              <Link
                href={href}
                rel={tab.label === "submit" || tab.label === "my" ? "nofollow" : undefined}
                aria-current={active ? "page" : undefined}
                className={`no-press flex min-h-14 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                  tab.emphasized
                    ? "text-accent-text font-semibold"
                    : active
                      ? "text-accent-text font-semibold"
                      : "text-muted"
                }`}
              >
                <TabInner
                  icon={tab.icon}
                  emphasized={tab.emphasized}
                  active={active}
                  label={
                    tab.label === "latest"
                      ? latestLabel(locale)
                      : tab.label === "brand"
                        ? homeLabel(locale)
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

function homeLabel(locale: ReturnType<typeof useLocale>["locale"]) {
  return (
    ({ ko: "홈", en: "Home", ja: "ホーム", zh: "首页", "zh-tw": "首頁", ar: "الرئيسية" } as Partial<Record<typeof locale, string>>)[locale] ?? "Home"
  );
}

function latestLabel(locale: ReturnType<typeof useLocale>["locale"]) {
  return (
    ({ ko: "최신", en: "Latest", ja: "最新", zh: "最新", "zh-tw": "最新", ar: "استكشاف" } as Partial<Record<typeof locale, string>>)[locale] ?? "Latest"
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
        className={`whitespace-nowrap text-[11px] leading-none sm:text-xs ${pending ? "text-accent-strong transition-colors" : ""}`}
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
function CommunityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 5.5h16v11H9l-5 3v-14Z" strokeLinejoin="round" />
      <path d="M8 10h8M8 13h5" strokeLinecap="round" />
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
