import {
  getMemeCountry,
  localizedMemeCountryLabel,
  ORIGIN_COUNTRY_LABELS,
  UNCONFIRMED_ORIGIN_LABELS,
  type MemeCountryCode,
  type MemeCountryLocale,
} from "@/lib/meme-country";

export function CountryFlagBadge({
  code,
  locale = "ko",
}: {
  code: MemeCountryCode | null;
  locale?: MemeCountryLocale;
}) {
  const country = code ? getMemeCountry(code) : null;
  const label = country
    ? localizedMemeCountryLabel(country.code, locale)
    : UNCONFIRMED_ORIGIN_LABELS[locale];
  const accessibleLabel = country ? `${ORIGIN_COUNTRY_LABELS[locale]}: ${label}` : label;

  return (
    <span
      title={label}
      data-country-code={code ?? "UNKNOWN"}
      data-country-flag={code ?? "unknown"}
      data-country-state={country ? "reviewed" : "unconfirmed"}
      className="relative z-10 inline-flex min-h-8 max-w-[min(52vw,12rem)] min-w-0 shrink-0 items-center rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-bold leading-tight text-foreground shadow-md"
    >
      <span className="sr-only">{accessibleLabel}</span>
      <span aria-hidden="true" className="truncate">{label}</span>
    </span>
  );
}
