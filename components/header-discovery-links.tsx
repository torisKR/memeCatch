"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";
import { localizedStaticPath, stripLocalePath } from "@/lib/i18n-routing";
import { normalizePathname } from "@/lib/normalize-pathname";

/** Primary desktop destinations. Secondary destinations live in HeaderMenu. */
export function HeaderDiscoveryLinks() {
  const pathname = stripLocalePath(normalizePathname(usePathname()));
  const { locale, messages } = useLocale();
  const latestHref = localizedStaticPath("/explore?sort=recent", locale);
  const latestLabel =
    ({ ko: "최신 밈", en: "Latest", ja: "最新", zh: "最新", "zh-tw": "最新" } as Partial<Record<typeof locale, string>>)[locale] ??
    messages.explore;
  const homeLabel =
    ({ ko: "홈", en: "Home", ja: "ホーム", zh: "首页", "zh-tw": "首頁" } as Partial<Record<typeof locale, string>>)[locale] ??
    "Home";
  const items = [
    { href: localizedStaticPath("/", locale), path: "/", label: homeLabel },
    { href: latestHref, path: "/explore", label: latestLabel },
  ];

  return (
    <nav aria-label={messages.discoveryNav} className="hidden shrink-0 items-center gap-1 md:flex">
      {items.map((item) => {
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
          <Link
            key={item.path}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? "bg-surface-2 font-semibold text-foreground" : "font-medium text-muted hover:bg-surface-2 hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
