"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useLocale } from "@/lib/i18n-client";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { localizedStaticPath } from "@/lib/i18n-routing";
import { PlusFeatures } from "@/components/premium/plus-features";
import { track } from "@/lib/analytics";

export function PricingContent() {
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale];

  useEffect(() => {
    track("plus_pricing_view", { locale, surface: "pricing" });
  }, [locale]);

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

      <section className="edge-signal relative mx-auto mt-10 max-w-xl overflow-hidden rounded-3xl p-6 shadow-lg sm:p-8" aria-labelledby="plus-plan-title">
        {/* 계측 격자 — edge-signal과 같은 노드에 두면 배경 shorthand가 grid-line을
            지우므로 별도 레이어로 둔다(status-panel.tsx 문법 재사용). */}
        <div aria-hidden className="instrument-grid pointer-events-none absolute inset-0" />
        <div className="relative flex items-start justify-between gap-4 sm:items-center">
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

        <ul className="relative mt-6 space-y-3">
          {copy.pricing.features.slice(1).map((feature) => (
            <li key={feature.label} className="flex gap-3 text-sm leading-relaxed sm:text-base">
              <span aria-hidden className="mt-0.5 text-accent-text">✓</span>
              <span><strong>{feature.label}</strong> · {feature.plus}</span>
            </li>
          ))}
        </ul>

        {/* 결제는 호스팅 결제창으로의 리다이렉트다. 어느 제공자(Unifi Pay·Latpeed)를
            쓸지는 서버가 환경변수로 정하므로 프론트는 하나의 폼만 유지한다.
            JS 없이도 동작하는 순수 form POST. */}
        <form
          action="/api/billing/checkout"
          method="post"
          className="relative mt-7"
          onSubmit={() => track("plus_checkout_started", { locale, surface: "pricing" })}
        >
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white shadow-sm transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
            {copy.pricing.checkout}
          </button>
        </form>
        <p className="relative mt-3 text-center text-sm text-muted">{copy.pricing.launchNote}</p>
        <p className="relative mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted">
          {copy.pricing.sameEmail}
        </p>
      </section>

      <PlusFeatures features={copy.pricing.features} heading={copy.pricing.featuresTitle} />

      <section className="mx-auto mt-14 max-w-3xl" aria-labelledby="comparison-title">
        <h2 id="comparison-title" className="text-center text-2xl font-black tracking-tight">
          {copy.pricing.comparisonTitle}
        </h2>
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] border-b-2 border-flame-500/70 bg-surface-2 px-4 py-3 text-sm font-bold sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
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
        <Link href={localizedStaticPath("/", locale)} className="underline underline-offset-4 hover:text-foreground">
          MemeCatch
        </Link>
      </p>
    </main>
  );
}
