import {
  countryFlag,
  getMemeCountry,
  type MemeCountryCode,
} from "@/lib/meme-country";

export function CountryFlagBadge({ code }: { code: MemeCountryCode | null }) {
  const country = code ? getMemeCountry(code) : null;
  const label = country ? `${country.label} 밈` : "출처 국가 미확인";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-country-code={code ?? "UNKNOWN"}
      data-country-flag={code ?? "unknown"}
      className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/70 bg-white/95 text-xl leading-none shadow-md"
    >
      <span aria-hidden>{countryFlag(code)}</span>
    </span>
  );
}
