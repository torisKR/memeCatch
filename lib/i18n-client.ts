"use client";

import { createContext, createElement, useContext, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getDocumentDirection, getDocumentLanguage, getMessages, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { isSeoContentLocale, parseLocalePath } from "@/lib/i18n-routing";
import { normalizePathname } from "@/lib/normalize-pathname";

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

function localeFromSearch(search: string): Locale | null {
  const value = new URLSearchParams(search).get("lang");
  return isLocale(value) ? value : null;
}

/** URL-owned locale choices must stay aligned with the server-rendered page. */
function localeFromCurrentUrl(): Locale | null {
  const prefixedLocale = localeFromPathname(window.location.pathname);
  if (prefixedLocale) return prefixedLocale;

  const queryLocale = localeFromSearch(window.location.search);
  if (queryLocale) return queryLocale;

  return normalizePathname(window.location.pathname) === "/"
    ? DEFAULT_LOCALE
    : null;
}

function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const urlLocale = localeFromCurrentUrl();
  if (urlLocale) return urlLocale;
  const value = document.cookie.split("; ").find((item) => item.startsWith(`${LOCALE_COOKIE}=`))?.split("=")[1];
  return isLocale(value) ? value : DEFAULT_LOCALE;
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
    document.documentElement.lang = getDocumentLanguage(locale);
    document.documentElement.dir = getDocumentDirection(locale);
  }, [locale]);

  return null;
}

/**
 * 접두사 없는 페이지는 서버가 그린 한국어 UI를 유지한다.
 * 브라우저 언어는 `/` 첫 방문 리다이렉트에서만 고르고, 그때 쿠키가 생긴다.
 * 여기서 다시 고르면 새로고침 뒤 메뉴가 영어로 바뀌었다가 한국어로 돌아온다.
 */
export function LocaleAutoDetect() {
  return null;
}

export function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = getDocumentLanguage(locale);
  document.documentElement.dir = getDocumentDirection(locale);
  // Private browsing and storage-restricted embeds can throw here. Cookie,
  // in-memory subscribers, and navigation must still complete.
  try {
    localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    /* locale cookie is sufficient */
  }
  window.dispatchEvent(new Event(EVENT_NAME));
}
