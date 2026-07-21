"use client";

import type { ReactNode } from "react";
import { useLocale } from "@/lib/i18n-client";
import { toBcp47 } from "@/lib/i18n";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { PremiumGate } from "@/components/premium/premium-gate";


export function PremiumDashboardContent({
  isPremium,
  status,
  currentPeriodEnd,
  feed,
}: {
  isPremium: boolean;
  status: string | null;
  currentPeriodEnd: string | null;
  feed: ReactNode;
}) {
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale];
  const accessConfirmedThrough = currentPeriodEnd
    ? new Intl.DateTimeFormat(toBcp47(locale), { dateStyle: "long" }).format(new Date(currentPeriodEnd))
    : null;

  return (
    <main
      data-membership-status={status ?? "none"}
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12"
    >
      <header className="rounded-3xl border border-border bg-surface p-6 shadow-sm sm:p-9">
        <p className="text-xs font-black tracking-[0.18em] text-accent-text">{copy.dashboard.eyebrow}</p>
        <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-balance text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              {isPremium ? copy.dashboard.activeTitle : copy.dashboard.upgradeTitle}
            </h1>
            <p className="mt-3 text-pretty leading-relaxed text-muted sm:text-lg">
              {isPremium ? copy.dashboard.activeBody : copy.dashboard.upgradeBody}
            </p>
          </div>
          {isPremium && (
            <span className="inline-flex w-fit rounded-full bg-accent-soft px-3 py-1.5 text-xs font-black tracking-wider text-accent-text">
              {copy.productName}
            </span>
          )}
        </div>
      </header>

      {isPremium ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
          <div className="min-w-0 [&>*:first-child]:mt-0">{feed}</div>
          <aside className="rounded-2xl border border-border bg-surface p-5 lg:sticky lg:top-20">
            <h2 className="font-bold">{copy.dashboard.membershipStatus}</h2>
            <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-safety-green">
              <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
              {copy.dashboard.active}
            </p>
            {accessConfirmedThrough && (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {copy.dashboard.renews}<br />
                <strong className="text-foreground">{accessConfirmedThrough}</strong>
              </p>
            )}
            <a
              href="mailto:ironjustlikethat@gmail.com?subject=MemeCatch%20Plus%20billing"
              className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copy.dashboard.billingHelp}
            </a>
          </aside>
        </div>
      ) : (
        <div className="mx-auto mt-8 max-w-2xl">
          <PremiumGate />
          <p className="mt-4 text-center text-sm leading-relaxed text-muted">{copy.dashboard.syncNote}</p>
          <p className="mt-2 text-center">
            <a
              href="mailto:ironjustlikethat@gmail.com?subject=MemeCatch%20Plus%20billing"
              className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline underline-offset-4 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {copy.dashboard.billingHelp}
            </a>
          </p>
        </div>
      )}
    </main>
  );
}
