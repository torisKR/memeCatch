"use client";

import { useSyncExternalStore } from "react";
import { LOCALE_COOKIE, isLocale, localeFromLanguageTag } from "@/lib/i18n";
import {
  isSeoContentLocale,
  localizedPath,
  type SeoContentLocale,
} from "@/lib/i18n-routing";

const HINT_COPY: Record<SeoContentLocale, { lead: string; cta: string }> = {
  en: { lead: "New to Korean memes?", cta: "Read the English edition" },
  ja: { lead: "韓国のミームを日本語で読みたい方へ", cta: "日本語版を見る" },
  zh: { lead: "想用中文了解韩国梗？", cta: "查看中文版" },
  "zh-tw": { lead: "想用中文了解韓國梗？", cta: "查看繁體中文版" },
};

function cookieLocale(cookie: string): string | null {
  const entry = cookie
    .split("; ")
    .find((item) => item.startsWith(`${LOCALE_COOKIE}=`));
  return entry ? entry.slice(LOCALE_COOKIE.length + 1) : null;
}

/**
 * 한국어 홈에 들어온 외국어 사용자에게 번역판 입구를 알려 준다.
 * 저장된 언어 선택이 브라우저 언어보다 우선하고, 한국어 사용자는 아무것도 보지 않는다.
 */
export function preferredEditionLocale(
  cookie: string,
  languages: readonly (string | undefined)[],
): SeoContentLocale | null {
  const saved = cookieLocale(cookie);
  if (saved && isLocale(saved)) {
    return isSeoContentLocale(saved) ? saved : null;
  }
  for (const tag of languages) {
    const detected = localeFromLanguageTag(tag);
    if (!detected) continue;
    if (detected === "ko") return null;
    if (isSeoContentLocale(detected)) return detected;
  }
  return null;
}

function subscribe(): () => void {
  // 언어 선택은 이 화면에서 바뀌지 않는다. 바뀌면 페이지가 다시 그려진다.
  return () => {};
}

function clientSnapshot(): SeoContentLocale | null {
  try {
    const languages = [...(navigator.languages ?? []), navigator.language];
    return preferredEditionLocale(document.cookie, languages);
  } catch {
    return null;
  }
}

function serverSnapshot(): SeoContentLocale | null {
  return null;
}

export function TranslatedEditionHint() {
  // 서버 HTML은 언어와 무관하게 같아야 캐시할 수 있으므로, 안내는 브라우저에서만 고른다.
  const locale = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);

  if (!locale) return null;
  const copy = HINT_COPY[locale];

  return (
    <p
      lang={locale === "zh-tw" ? "zh-Hant" : locale === "zh" ? "zh-Hans" : locale}
      className="mx-auto mb-4 flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-border bg-surface px-4 py-2 text-sm text-foreground"
    >
      <span className="text-muted">{copy.lead}</span>
      <a
        href={localizedPath("/", locale)}
        hrefLang={locale}
        className="inline-flex min-h-11 items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {copy.cta} <span aria-hidden>→</span>
      </a>
    </p>
  );
}
