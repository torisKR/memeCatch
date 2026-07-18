"use client";

import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  LANGUAGE_NAMES,
  LANGUAGE_SHORT_NAMES,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n";
import { persistLocale, useLocale } from "@/lib/i18n-client";

/**
 * 본문 번역(en/ja/zh)이 실제로 존재하는 라우트. 홈·밈 상세·탐색 등은 본문이
 * 한국어 고정이라 선택기를 노출하면 "미완성 번역 사이트" 인상을 주므로,
 * 번역 커버리지가 확보된 라우트에서만 헤더에 렌더한다.
 * 이미 쿠키(en/ja/zh)를 저장한 사용자의 크롬 번역은 LocaleProvider가 유지한다.
 */
const TRANSLATED_ROUTES = ["/news", "/products", "/pricing", "/premium", "/my"];

export function LanguageSelector() {
  const pathname = usePathname();
  const router = useRouter();
  const { locale, messages } = useLocale();

  const translated = TRANSLATED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!translated) return null;

  function changeLocale(nextLocale: Locale) {
    persistLocale(nextLocale);
    router.refresh();
  }

  return (
    <label className="relative grid h-11 min-w-[4.75rem] shrink-0 cursor-pointer grid-cols-[1rem_1fr_auto] items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs font-bold text-foreground transition-colors hover:border-accent focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/20">
      <span className="sr-only">{messages.language}</span>
      <GlobeIcon className="h-4 w-4 text-muted" />
      <span aria-hidden>{LANGUAGE_SHORT_NAMES[locale]}</span>
      <ChevronDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      <select
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        aria-label={messages.languageMenu}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {SUPPORTED_LOCALES.map((item) => <option key={item} value={item}>{LANGUAGE_NAMES[item]}</option>)}
      </select>
    </label>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
}
