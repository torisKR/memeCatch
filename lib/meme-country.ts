export const MEME_COUNTRIES = {
  KR: { code: "KR", label: "대한민국", localLanguage: "한국어", languageTag: "ko-KR" },
  US: { code: "US", label: "미국", localLanguage: "English", languageTag: "en-US" },
  JP: { code: "JP", label: "일본", localLanguage: "日本語", languageTag: "ja-JP" },
  GB: { code: "GB", label: "영국", localLanguage: "English", languageTag: "en-GB" },
  BR: { code: "BR", label: "브라질", localLanguage: "Português", languageTag: "pt-BR" },
  MX: { code: "MX", label: "멕시코", localLanguage: "Español", languageTag: "es-MX" },
  CN: { code: "CN", label: "중국", localLanguage: "简体中文", languageTag: "zh-CN" },
  TW: { code: "TW", label: "대만", localLanguage: "繁體中文", languageTag: "zh-TW" },
  DE: { code: "DE", label: "독일", localLanguage: "Deutsch", languageTag: "de-DE" },
  FR: { code: "FR", label: "프랑스", localLanguage: "Français", languageTag: "fr-FR" },
} as const;

export type MemeCountryCode = keyof typeof MEME_COUNTRIES;

export type MemeCountryLocale = "ko" | "en" | "ja" | "zh" | "zh-tw";

const LOCALIZED_COUNTRY_LABELS: Record<MemeCountryLocale, Record<MemeCountryCode, string>> = {
  ko: {
    KR: "대한민국", US: "미국", JP: "일본", GB: "영국", BR: "브라질",
    MX: "멕시코", CN: "중국", TW: "대만", DE: "독일", FR: "프랑스",
  },
  en: {
    KR: "South Korea", US: "United States", JP: "Japan", GB: "United Kingdom", BR: "Brazil",
    MX: "Mexico", CN: "China", TW: "Taiwan", DE: "Germany", FR: "France",
  },
  ja: {
    KR: "韓国", US: "アメリカ", JP: "日本", GB: "イギリス", BR: "ブラジル",
    MX: "メキシコ", CN: "中国", TW: "台湾", DE: "ドイツ", FR: "フランス",
  },
  zh: {
    KR: "韩国", US: "美国", JP: "日本", GB: "英国", BR: "巴西",
    MX: "墨西哥", CN: "中国", TW: "台湾", DE: "德国", FR: "法国",
  },
  "zh-tw": {
    KR: "韓國", US: "美國", JP: "日本", GB: "英國", BR: "巴西",
    MX: "墨西哥", CN: "中國", TW: "台灣", DE: "德國", FR: "法國",
  },
};

export const UNCONFIRMED_ORIGIN_LABELS: Record<MemeCountryLocale, string> = {
  ko: "출처 국가 미확인",
  en: "Origin unconfirmed",
  ja: "出典国未確認",
  zh: "来源国家未确认",
  "zh-tw": "來源國家未確認",
};

export const ORIGIN_COUNTRY_LABELS: Record<MemeCountryLocale, string> = {
  ko: "출처 국가",
  en: "Origin country",
  ja: "出典国",
  zh: "来源国家",
  "zh-tw": "來源國家",
};

export type MemeOriginProfile = {
  market_code: string;
  role: string;
  review_state: string;
};

export function isMemeCountryCode(value: string): value is MemeCountryCode {
  return Object.hasOwn(MEME_COUNTRIES, value);
}

export function getMemeCountry(
  code: MemeCountryCode,
): (typeof MEME_COUNTRIES)[MemeCountryCode];
export function getMemeCountry(
  code: string | null | undefined,
): (typeof MEME_COUNTRIES)[MemeCountryCode] | null;
export function getMemeCountry(code: string | null | undefined) {
  return code && isMemeCountryCode(code) ? MEME_COUNTRIES[code] : null;
}

export function localizedMemeCountryLabel(
  code: MemeCountryCode,
  locale: MemeCountryLocale = "ko",
): string {
  return LOCALIZED_COUNTRY_LABELS[locale][code];
}

export function countryFlag(code: MemeCountryCode | null | undefined): string {
  if (!code) return "🌐";
  return String.fromCodePoint(
    ...[...code].map((letter) => letter.charCodeAt(0) + 127397),
  );
}

export function originCountryCode(
  profiles: readonly MemeOriginProfile[] | null | undefined,
): MemeCountryCode | null {
  for (const profile of profiles ?? []) {
    if (profile.role !== "origin" || profile.review_state !== "reviewed") continue;
    const code = profile.market_code.trim().toUpperCase();
    if (isMemeCountryCode(code)) return code;
  }
  return null;
}
