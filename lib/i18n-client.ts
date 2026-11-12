"use client";

import { createContext, createElement, useContext, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getDocumentDirection, getDocumentLanguage, getMessages, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { isSeoContentLocale, parseLocalePath } from "@/lib/i18n-routing";

const EVENT_NAME = "memecatch:locale-change";
type LocaleContextValue = ReturnType<typeof createLocaleContextValue>;
const LocaleContext = createContext<LocaleContextValue | null>(null);

function createLocaleContextValue(locale: Locale) {
  return { locale, messages: getMessages(locale) };
}

/** Locale prefixes are shareable/crawlable, so they always beat local preference. */
function localeFromPathname(pathname: string): Locale | null {
  const parsed = parseLocalePath(pathname);
  return parsed.hadLocalePrefix && isSeoContentLocale(parsed.locale) ? parsed.locale : null;
}

/**
 * Chrome and `html lang` follow the URL. An unprefixed path is Korean even
 * when a stale `memecatch_locale` cookie or `?lang=` is present. The cookie
 * is only a preference for `/` navigation, written by the language selector.
 */
function localeFromCurrentUrl(): Locale {
  return localeFromPathname(window.location.pathname) ?? DEFAULT_LOCALE;
}

/**
 * Selector choice for the path it was made on. A stale cookie still does not
 * win on load: this is memory from `persistLocale` in the current document,
 * and a different URL drops it so chrome follows the URL again.
 */
let inPlaceLocale: { locale: Locale; path: string } | null = null;

export function clearInPlaceLocale(): void {
  inPlaceLocale = null;
}

function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const path = window.location.pathname;
  if (inPlaceLocale && inPlaceLocale.path === path) return inPlaceLocale.locale;
  return localeFromCurrentUrl();
}

function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = getDocumentLanguage(locale);
  document.documentElement.dir = getDocumentDirection(locale);
}

function subscribe(listener: () => void) {
  window.addEventListener(EVENT_NAME, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT_NAME, listener);
    window.removeEventListener("storage", listener);
  };
}

export function LocaleProvider({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale: Locale;
}) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => initialLocale);
  return createElement(
    LocaleContext.Provider,
    { value: createLocaleContextValue(locale) },
    children,
  );
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}

export function LocaleDocumentSync() {
  const { locale } = useLocale();

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  return null;
}

/**
 * 접두사 없는 페이지는 URL 로케일(ko)을 유지한다.
 * 브라우저 언어나 남은 쿠키로 크롬을 바꾸지 않는다.
 */
export function LocaleAutoDetect() {
  return null;
}

export function persistLocale(locale: Locale) {
  inPlaceLocale = { locale, path: window.location.pathname };
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  applyDocumentLocale(locale);
  // Private browsing and storage-restricted embeds can throw here. Cookie,
  // in-memory subscribers, and navigation must still complete.
  try {
    localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    /* locale cookie is sufficient */
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}
