"use client";

import { useEffect, useSyncExternalStore } from "react";
import { DEFAULT_LOCALE, getDocumentLanguage, getMessages, isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";

const EVENT_NAME = "memecatch:locale-change";

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

export function useLocale(initialLocale: Locale = DEFAULT_LOCALE) {
  const locale = useSyncExternalStore(subscribe, readLocale, () => initialLocale);
  return { locale, messages: getMessages(locale) };
}

export function LocaleDocumentSync({ locale: initialLocale }: { locale: Locale }) {
  const { locale } = useLocale(initialLocale);

  useEffect(() => {
    document.documentElement.lang = getDocumentLanguage(locale);
  }, [locale]);

  return null;
}

export function persistLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.documentElement.lang = getDocumentLanguage(locale);
  localStorage.setItem(LOCALE_COOKIE, locale);
  window.dispatchEvent(new Event(EVENT_NAME));
}
