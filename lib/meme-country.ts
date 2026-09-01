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
