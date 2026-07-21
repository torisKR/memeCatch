"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  LANGUAGE_FLAGS,
  LANGUAGE_NAMES,
  LANGUAGE_SHORT_NAMES,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n";
import { persistLocale, useLocale } from "@/lib/i18n-client";

/**
 * 헤더 언어 선택기 — 전 라우트에 노출한다.
 * 첫 방문 시 LocaleAutoDetect가 브라우저 언어로 자동 설정하고,
 * 여기서 수동으로 바꾸면 쿠키에 저장되어 이후 방문에도 유지된다.
 * 본번역(ko/en/ja/zh) 외 로케일은 en(zh-tw는 zh)으로 폴백 렌더된다.
 */
export function LanguageSelector() {
  const router = useRouter();
  const { locale, messages } = useLocale();

  function changeLocale(nextLocale: Locale) {
    persistLocale(nextLocale);
    router.refresh();
  }

  return (
    <label className="relative grid h-11 min-w-[5.25rem] shrink-0 cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-bold text-foreground transition-colors hover:border-accent focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/20">
      <span className="sr-only">{messages.language}</span>
      <span aria-hidden className="text-sm leading-none">{LANGUAGE_FLAGS[locale]}</span>
      <span aria-hidden>{LANGUAGE_SHORT_NAMES[locale]}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      <select
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        aria-label={messages.languageMenu}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {SUPPORTED_LOCALES.map((item) => (
          <option key={item} value={item}>
            {LANGUAGE_FLAGS[item]} {LANGUAGE_NAMES[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
