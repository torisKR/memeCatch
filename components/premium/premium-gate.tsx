"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n-client";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { localizedStaticPath } from "@/lib/i18n-routing";

export function PremiumGate({ compact = false }: { compact?: boolean }) {
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale];

  return (
    <section className={`rounded-2xl border border-accent/25 bg-accent-soft/40 ${compact ? "p-5" : "p-6 sm:p-8"}`}>
      <span className="inline-flex rounded-full bg-surface px-2.5 py-1 text-xs font-black tracking-wider text-accent-text shadow-sm">
        {copy.badge}
      </span>
      <h2 className="mt-3 text-xl font-black tracking-tight">{copy.dashboard.upgradeTitle}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">{copy.dashboard.upgradeBody}</p>
      <Link href={localizedStaticPath("/pricing", locale)} className="hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)] mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-5 text-sm font-bold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
        {copy.dashboard.viewPlans}
      </Link>
    </section>
  );
}
