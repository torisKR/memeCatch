"use client";

import { useRouter } from "next/navigation";
import { LANGUAGE_NAMES, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";
import { persistLocale, useLocale } from "@/lib/i18n-client";

export function LanguageSelector() {
  const router = useRouter();
  const { locale, messages } = useLocale();

  function changeLocale(nextLocale: Locale) {
    persistLocale(nextLocale);
    router.refresh();
  }

  return (
    <label className="relative flex items-center">
      <span className="sr-only">{messages.language}</span>
      <GlobeIcon className="pointer-events-none absolute left-3 h-4 w-4 text-muted" />
      <select
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        aria-label={messages.languageMenu}
        className="h-11 w-11 appearance-none rounded-full border border-border bg-surface py-0 pl-9 pr-0 text-xs font-semibold text-foreground outline-none transition-colors hover:border-accent focus:border-accent focus:ring-4 focus:ring-accent/20 sm:w-auto sm:pr-7 md:w-11 md:pr-0 lg:w-auto lg:pr-7"
      >
        {SUPPORTED_LOCALES.map((item) => <option key={item} value={item}>{LANGUAGE_NAMES[item]}</option>)}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2.5 hidden text-[10px] text-muted sm:block md:hidden lg:block">▼</span>
    </label>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>;
}
