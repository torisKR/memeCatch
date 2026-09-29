"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";
import { localizedStaticPath, stripLocalePath } from "@/lib/i18n-routing";
import { normalizePathname } from "@/lib/normalize-pathname";

/** Direct desktop destinations; links to unlocalized pages stay unprefixed. */
export function HeaderDiscoveryLinks() {
  const pathname = stripLocalePath(normalizePathname(usePathname()));
  const { locale, messages } = useLocale();
  const latestHref = localizedStaticPath("/explore?sort=recent", locale);
  const latestLabel =
    ({ ko: "최신 밈", en: "Latest", ja: "最新", zh: "最新", "zh-tw": "最新" } as Partial<Record<typeof locale, string>>)[locale] ??
    messages.explore;
  const items = [
    { href: latestHref, path: "/explore", label: latestLabel },
    { href: "/community", path: "/community", label: messages.community },
    { href: "/products", path: "/products", label: messages.products },
  ];

  return (
    <nav aria-label={messages.discoveryNav} className="hidden shrink-0 items-center gap-0.5 md:flex lg:gap-1">
      {items.map((item) => {
        const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
        return (
          <Link
            key={item.path}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full px-2 lg:px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${active ? "bg-surface-2 font-semibold text-foreground" : "font-medium text-muted hover:bg-surface-2 hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
