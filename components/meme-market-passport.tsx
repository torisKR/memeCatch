import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { MARKET_PASSPORT_COPY } from "@/lib/i18n-market-passport";
import {
  marketName,
  relationLabel,
  type MemeMarketPassport,
  type MarketPassportRole,
} from "@/lib/meme-market-passport";

function roleLabel(role: MarketPassportRole, copy: ReturnType<typeof getCopy>): string {
  if (role === "origin") return copy.originRole;
  if (role === "active") return copy.active;
  return copy.adopted;
}

function getCopy(locale: Locale) {
  return MARKET_PASSPORT_COPY[locale];
}

export function MemeMarketPassport({
  passport,
  locale,
}: {
  passport: MemeMarketPassport;
  locale: Locale;
}) {
  const copy = getCopy(locale);

  if (passport.dataStatus === "unavailable") {
    return (
      <section
        aria-labelledby="meme-market-passport-unavailable-title"
        data-market-passport="unavailable"
        data-market-profile-count={passport.profiles.length}
        data-market-variant-count={passport.variants.length}
        className="rounded-2xl border border-safety-yellow/30 bg-safety-yellow-bg/40 p-5"
        role="status"
      >
        <h2 id="meme-market-passport-unavailable-title" className="font-bold">
          {copy.unavailableTitle}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{copy.unavailableBody}</p>
      </section>
    );
  }

  if (passport.profiles.length === 0 && passport.variants.length === 0) return null;

  return (
    <section
      aria-labelledby="meme-market-passport-title"
      data-market-passport={passport.dataStatus ?? "reviewed"}
      data-market-profile-count={passport.profiles.length}
      data-market-variant-count={passport.variants.length}
      className="rounded-2xl border border-border bg-surface-2 p-5 sm:p-7"
    >
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-signal-cyan">
        {copy.eyebrow}
      </p>
      <h2 id="meme-market-passport-title" className="mt-1 text-xl font-black tracking-tight">
        {copy.title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {copy.description}
      </p>

      {passport.profiles.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {passport.profiles.map((profile) => (
            <article
              key={`${profile.marketCode}-${profile.role}`}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-muted">
                    {roleLabel(profile.role, copy)}
                  </p>
                  <h3 className="mt-1 font-bold">
                    {marketName(profile.marketCode, copy.marketNames)}
                  </h3>
                </div>
                <span className="rounded-full bg-accent-soft px-2 py-1 text-xs font-semibold text-accent-text">
                  {profile.marketCode}
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold">{profile.localTitle}</p>
              <p className="mt-1 text-xs text-muted">
                {copy.language}: {profile.languageTag}
              </p>
              {profile.usageNote && (
                <p className="mt-3 text-sm leading-relaxed">
                  <strong>{copy.usage}:</strong> {profile.usageNote}
                </p>
              )}
              {profile.caution && (
                <p className="mt-2 text-sm leading-relaxed text-safety-yellow">
                  <strong>{copy.caution}:</strong> {profile.caution}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {passport.variants.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="font-bold">{copy.variantTitle}</h3>
          <p className="mt-1 text-sm text-muted">{copy.variantDescription}</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {passport.variants.map((variant) => (
              <li key={variant.id}>
                <Link
                  href={variant.targetHref}
                  className="block rounded-xl border border-border bg-surface px-3 py-3 transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <span className="block text-xs font-semibold text-muted">
                    {relationLabel(variant.relation, copy.relations)}
                  </span>
                  <span className="mt-1 block font-semibold">{variant.targetTitle}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
