"use client";

import { createContext, createElement, useContext, useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getDocumentDirection, getDocumentLanguage, getMessages, isLocale, localeFromLanguageTag, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

const EVENT_NAME = "memecatch:locale-change";
type LocaleContextValue = ReturnType<typeof createLocaleContextValue>;
const LocaleContext = createContext<LocaleContextValue | null>(null);

function createLocaleContextValue(locale: Locale) {
  return { locale, messages: getMessages(locale) };
}

function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
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
  localStorage.setItem(LOCALE_COOKIE, locale);
  window.dispatchEvent(new Event(EVENT_NAME));
}
