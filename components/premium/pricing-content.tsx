"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n-client";
import { PREMIUM_COPY } from "@/lib/i18n-premium";

export function PricingContent() {
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-bold tracking-[0.16em] text-accent-text">
          {copy.pricing.eyebrow}
        </p>
        <h1 className="mt-3 text-balance text-4xl font-black tracking-[-0.045em] sm:text-6xl">
          {copy.pricing.title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-pretty text-base leading-relaxed text-muted sm:text-lg">
          {copy.pricing.intro}
        </p>
      </header>

      <section className="mx-auto mt-10 max-w-xl rounded-3xl border border-accent/30 bg-surface p-6 shadow-lg sm:p-8" aria-labelledby="plus-plan-title">
        <div className="flex items-start justify-between gap-4 sm:items-center">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-black tracking-wider text-accent-text">
              {copy.badge}
            </span>
            <h2 id="plus-plan-title" className="mt-3 text-2xl font-black">
              {copy.productName}
            </h2>
          </div>
          <p className="shrink-0 text-right">
            <span className="block whitespace-nowrap text-2xl font-black tracking-tight sm:text-3xl">{copy.pricing.monthly}</span>
            <span className="block text-sm text-muted">{copy.pricing.perMonth}</span>
          </p>
        </div>

        <ul className="mt-6 space-y-3">
          {copy.pricing.features.slice(1).map((feature) => (
            <li key={feature.label} className="flex gap-3 text-sm leading-relaxed sm:text-base">
              <span aria-hidden className="mt-0.5 text-accent-text">✓</span>
              <span><strong>{feature.label}</strong> · {feature.plus}</span>
            </li>
          ))}
        </ul>

        <form action="/api/billing/checkout" method="post" className="mt-7">
          <button type="submit" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white shadow-sm transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            {copy.pricing.checkout}
          </button>
        </form>
        <p className="mt-3 text-center text-sm text-muted">{copy.pricing.launchNote}</p>
        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted">
          {copy.pricing.sameEmail}
        </p>
      </section>

      <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="comparison-title">
        <h2 id="comparison-title" className="text-center text-2xl font-black tracking-tight">
          {copy.pricing.comparisonTitle}
        </h2>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] border-b border-border bg-surface-2 px-4 py-3 text-sm font-bold sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
            <span className="sr-only">{copy.pricing.comparisonTitle}</span>
            <span className="text-center">{copy.pricing.freeName}</span>
            <span className="text-center text-accent-text">{copy.pricing.plusName}</span>
          </div>
          {copy.pricing.features.map((feature) => (
            <div key={feature.label} className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center border-b border-border px-4 py-3 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
              <span className="min-w-0 pr-2 font-medium">{feature.label}</span>
              <span className="text-center text-muted">{feature.free}</span>
              <span className="text-center font-semibold text-accent-text">{feature.plus}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-10 text-center text-sm text-muted">
        <Link href="/" className="underline underline-offset-4 hover:text-foreground">
          MemeCatch
        </Link>
      </p>
    </main>
  );
}
