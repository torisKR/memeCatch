import "server-only";

import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_HEADER, type Locale } from "@/lib/i18n";

export async function getRequestLocale(): Promise<Locale> {
  const locale = (await headers()).get(LOCALE_HEADER);
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}
