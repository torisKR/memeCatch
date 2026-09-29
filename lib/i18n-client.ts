"use client";

import { createContext, createElement, useContext, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getDocumentDirection, getDocumentLanguage, getMessages, isLocale, localeFromLanguageTag, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
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
 * 첫 방문(쿠키 없음) 시 브라우저 언어(navigator.languages) 기반으로
 * 로케일을 1회 자동 설정한다. ko로 감지되면 쿠키를 남기지 않아
 * 기존 한국어 사용자의 동작은 그대로 유지된다.
 */
export function LocaleAutoDetect() {
  useEffect(() => {
    try {
      // A locale URL is an explicit, shareable choice. Do not overwrite it with
      // the browser preference during hydration.
      if (localeFromCurrentUrl()) return;
      const hasCookie = document.cookie
        .split("; ")
        .some((item) => item.startsWith(`${LOCALE_COOKIE}=`));
      if (hasCookie) return;
      const candidates = [...(navigator.languages ?? []), navigator.language];
      for (const tag of candidates) {
        const detected = localeFromLanguageTag(tag);
        if (!detected) continue;
        if (detected !== DEFAULT_LOCALE) persistLocale(detected);
        return;
      }
    } catch {
      /* noop — 감지 실패 시 기본 로케일 유지 */
    }
  }, []);

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
