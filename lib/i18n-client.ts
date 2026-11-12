"use client";

import { createContext, createElement, useContext, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, documentLocaleFromPathname, getDocumentDirection, getDocumentLanguage, getMessages, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

const EVENT_NAME = "memecatch:locale-change";
type LocaleContextValue = ReturnType<typeof createLocaleContextValue>;
const LocaleContext = createContext<LocaleContextValue | null>(null);

function createLocaleContextValue(locale: Locale) {
  return { locale, messages: getMessages(locale) };
}

/** Locale prefixes are shareable/crawlable, so they always beat local preference. */
function localeFromPathname(pathname: string): Locale | null {
  return documentLocaleFromPathname(pathname);
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
 * Selector choice for the path it was made on, plus the path the selector
 * navigates to. A stale cookie still does not win on load: this is memory
 * from `persistLocale` in the current document. Crossing a locale prefix
 * remounts this module, so that destination is also stored until the new
 * page arrives. Any later URL drops it, so chrome follows the URL again.
 */
let inPlaceLocale: { locale: Locale; paths: readonly string[] } | null = null;
let historyNotifyInstalled = false;

/**
 * Destination of a selector choice. Module memory dies when a prefixed route
 * remounts onto an unprefixed one, so the destination is also stored here
 * until that exact path is shown. It never overrides a different URL.
 */
export const LOCALE_DESTINATION_STORAGE_KEY = "memecatch:locale-destination";
export const LOCALE_DESTINATION_TTL_MS = 15_000;

type StoredLocaleDestination = {
  locale: Locale;
  path: string;
  at: number;
};

function clearStoredDestination(): void {
  try {
    sessionStorage.removeItem(LOCALE_DESTINATION_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

function rememberLocaleDestination(locale: Locale, path: string): void {
  try {
    const payload: StoredLocaleDestination = { locale, path, at: Date.now() };
    sessionStorage.setItem(LOCALE_DESTINATION_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* in-memory flag still covers this document */
  }
}

function readStoredDestination(): StoredLocaleDestination | "invalid" | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(LOCALE_DESTINATION_STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return "invalid";
    const record = parsed as { locale?: unknown; path?: unknown; at?: unknown };
    if (typeof record.locale !== "string" || !isLocale(record.locale)) return "invalid";
    if (typeof record.path !== "string" || !record.path.startsWith("/")) return "invalid";
    if (typeof record.at !== "number" || !Number.isFinite(record.at)) return "invalid";
    return { locale: record.locale, path: record.path, at: record.at };
  } catch {
    return "invalid";
  }
}

export function clearInPlaceLocale(): void {
  inPlaceLocale = null;
  clearStoredDestination();
}

function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const path = window.location.pathname;
  const stored = readStoredDestination();
  if (stored === "invalid") {
    clearStoredDestination();
  } else if (stored) {
    const fresh = Date.now() - stored.at <= LOCALE_DESTINATION_TTL_MS;
    if (!fresh) {
      clearStoredDestination();
    } else if (stored.path === path) {
      inPlaceLocale = { locale: stored.locale, paths: [path] };
      clearStoredDestination();
      return stored.locale;
    }
  }
  if (inPlaceLocale?.paths.includes(path)) return inPlaceLocale.locale;
  return localeFromCurrentUrl();
}

/** Once the selector's destination is current, forget the source path so Back follows the URL. */
function retainInPlaceDestination(): void {
  if (!inPlaceLocale || inPlaceLocale.paths.length < 2) return;
  const path = window.location.pathname;
  const destination = inPlaceLocale.paths[inPlaceLocale.paths.length - 1];
  if (path === destination) inPlaceLocale = { locale: inPlaceLocale.locale, paths: [path] };
}

function installHistoryNotify(): void {
  if (historyNotifyInstalled || typeof window === "undefined") return;
  historyNotifyInstalled = true;
  const notify = () => {
    retainInPlaceDestination();
    window.dispatchEvent(new Event(EVENT_NAME));
  };
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method].bind(history);
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      notify();
      return result;
    };
  }
  window.addEventListener("popstate", notify);
}

function applyDocumentLocale(locale: Locale): void {
  document.documentElement.lang = getDocumentLanguage(locale);
  document.documentElement.dir = getDocumentDirection(locale);
}

function subscribe(listener: () => void) {
  installHistoryNotify();
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

export function persistLocale(locale: Locale, nextPath?: string) {
  const current = window.location.pathname;
  const destination = nextPath && nextPath.length > 0 ? nextPath : current;
  inPlaceLocale = {
    locale,
    paths: destination === current ? [current] : [current, destination],
  };
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  applyDocumentLocale(locale);
  // Private browsing and storage-restricted embeds can throw here. Cookie,
  // in-memory subscribers, and navigation must still complete.
  try {
    localStorage.setItem(LOCALE_COOKIE, locale);
  } catch {
    /* locale cookie is sufficient */
  }
  if (destination !== current) rememberLocaleDestination(locale, destination);
  window.dispatchEvent(new Event(EVENT_NAME));
}
