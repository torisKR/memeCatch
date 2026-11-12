"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  LANGUAGE_FLAGS,
  LANGUAGE_NAMES,
  LANGUAGE_SHORT_NAMES,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n";
import { persistLocale, useLocale } from "@/lib/i18n-client";
import {
  SEO_ROUTE_LOCALES,
  isSeoContentLocale,
  isLocalizedStaticPath,
  localizedPath,
  localizedStaticPath,
  parseLocalePath,
} from "@/lib/i18n-routing";
import { normalizePathname } from "@/lib/normalize-pathname";

function withoutLangQuery(value: string): string {
  const url = new URL(value, "https://memecatch.test");
  url.searchParams.delete("lang");
  return `${url.pathname}${url.search}${url.hash}`;
}

function isHomePath(pathname: string): boolean {
  return normalizePathname(parseLocalePath(pathname).pathname) === "/";
}

function destinationPath(destination: string): string {
  return new URL(destination, "https://memecatch.local").pathname;
}

/**
 * Return the route needed to apply a locale, or `null` when the cookie-driven
 * UI can update in place. The global selector does not know which individual
 * meme translations exist, so only the detail page's availability-aware nav
 * may link directly between translated details.
 */
export function localeDestination(pathname: string, nextLocale: Locale): string | null {
  const pathnameWithoutLang = withoutLangQuery(pathname);
  const parsed = parseLocalePath(pathnameWithoutLang);

  // UI-only locales have no URL prefix. Drop an existing SEO prefix only when
  // necessary. A stale lang query also requires navigation so it cannot
  // override the newly persisted locale on refresh.
  if (!isSeoContentLocale(nextLocale) && nextLocale !== "ko") {
    return parsed.hadLocalePrefix || pathnameWithoutLang !== pathname
      ? parsed.pathname
      : null;
  }

  if (nextLocale === "ko") return parsed.pathname;

  // Home and Plus pricing have real translated static pages. Keep the user in
  // the conversion flow instead of dropping them back at the home page.
  if (isLocalizedStaticPath(parsed.pathname)) {
    return localizedStaticPath(parsed.pathname, nextLocale);
  }

  // Every SEO locale has a home page. A foreign detail (or any other route)
  // may not exist, so the global selector uses the guaranteed-safe home.
  return localizedPath("/", nextLocale);
}

/**
 * 헤더 언어 선택기 — 전 라우트에 노출한다.
 * 첫 방문 시 LocaleAutoDetect가 브라우저 언어로 자동 설정하고,
 * 여기서 수동으로 바꾸면 쿠키에 저장되어 이후 방문에도 유지된다.
 * 본번역(ko/en/ja/zh) 외 로케일은 en(zh-tw는 zh)으로 폴백 렌더된다.
 */
export function LanguageSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale, messages } = useLocale();
  const availableLocales = isHomePath(pathname) ? SEO_ROUTE_LOCALES : SUPPORTED_LOCALES;

  function changeLocale(nextLocale: Locale) {
    const destination = localeDestination(
      `${pathname}${typeof window === "undefined" ? "" : window.location.search}`,
      nextLocale,
    );
    persistLocale(nextLocale, destination ? destinationPath(destination) : undefined);
    if (destination) router.push(destination);
    else router.refresh();
  }

  return (
    <label className="glass-panel relative grid h-11 min-w-[5.25rem] shrink-0 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-1.5 rounded-full px-3 text-xs font-bold text-foreground transition-shadow hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_55%,transparent)] focus-within:ring-4 focus-within:ring-(--flame-500)/20">
      <span className="sr-only">{messages.language}</span>
      <span aria-hidden className="relative text-sm leading-none">
        {LANGUAGE_FLAGS[locale]}
        {/* 활성 로케일 표시 — flame 닷(정적, 장식용) */}
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-(--flame-500)"
        />
      </span>
      <span aria-hidden>{LANGUAGE_SHORT_NAMES[locale]}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      <select
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        aria-label={messages.languageMenu}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {availableLocales.map((item) => (
          <option key={item} value={item}>
            {LANGUAGE_FLAGS[item]} {LANGUAGE_NAMES[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
