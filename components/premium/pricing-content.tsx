"use client";

import Link from "next/link";
import { useEffect } from "react";
import { withLocaleFallback, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n-client";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { localizedStaticPath } from "@/lib/i18n-routing";
import { cjkKeepPhrases } from "@/lib/cjk-keep-phrase";
import { PlusFeatures } from "@/components/premium/plus-features";
import { track } from "@/lib/analytics";
import { FairySupportOption } from "@/components/premium/fairy-support-option";
import styles from "@/components/premium/pricing-content.module.css";

const PRICING_TITLE_PHRASES: Partial<Record<Locale, readonly string[]>> = {
  ja: ["今日", "投稿する", "ミーム", "3つと", "媒体別", "コピーを", "受け取る"],
  zh: ["获取", "今天", "可发布的", "3个", "迷因", "及", "各平台", "文案"],
  "zh-tw": ["今天", "就能", "使用的", "已審核", "迷因"],
};

const CHECKOUT_UNAVAILABLE = withLocaleFallback({
  ko: "신규 결제는 현재 잠시 중단되어 있습니다.",
  en: "New purchases are temporarily unavailable.",
  ja: "新規のお支払いは現在一時停止しています。",
  zh: "新购买目前暂时不可用。",
  "zh-tw": "新購買目前暫時無法使用。",
});

export function PricingContent({
  checkoutEnabled = false,
  fairyMinimumAmount,
}: {
  checkoutEnabled?: boolean;
  fairyMinimumAmount?: number;
} = {}) {
  const { locale } = useLocale();
  const copy = PREMIUM_COPY[locale];

  useEffect(() => {
    track("plus_pricing_view", { locale, surface: "pricing" });
    track("paywall_view", { locale, surface: "pricing" });
  }, [locale]);

  return (
    <main className={`${styles.root} mx-auto w-full max-w-6xl px-4 py-10 sm:py-16 lg:py-20`}>
      <header className={`${styles.hero} grid gap-5 border-b border-border pb-8 sm:pb-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-end lg:gap-16`}>
        <div className={styles.heroCopy}>
          <p className={`${styles.eyebrow} text-xs font-bold uppercase tracking-[0.16em] text-accent-text`}>
            {copy.pricing.eyebrow}
          </p>
          <h1 className={`${styles.title} mt-4 text-balance text-4xl font-black leading-[1.06] tracking-[-0.045em] sm:text-6xl`}>
            {cjkKeepPhrases(copy.pricing.title, PRICING_TITLE_PHRASES[locale], styles.keepPhrase)}
          </h1>
        </div>
        <p className={`${styles.intro} max-w-2xl text-pretty text-base leading-relaxed text-muted sm:text-lg`}>
          {copy.pricing.intro}
        </p>
      </header>

      <section className="mt-10 grid items-start gap-6 lg:mt-12 lg:grid-cols-[minmax(0,1.08fr)_minmax(22rem,0.92fr)]" aria-labelledby="comparison-title">
        <div>
          <h2 id="comparison-title" className="max-w-2xl text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            {copy.pricing.comparisonTitle}
          </h2>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] items-center border-b border-border bg-surface-2 px-4 py-4 text-sm font-black sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:px-6">
              <span className="sr-only">{copy.pricing.comparisonTitle}</span>
              <span className="text-center">{copy.pricing.freeName}</span>
              <span className="rounded-lg bg-accent-soft px-2 py-1 text-center text-accent-text">
                {copy.pricing.plusName}
              </span>
            </div>
            {copy.pricing.features.map((feature) => (
              <div key={feature.label} className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] items-center border-b border-border px-4 py-4 text-sm last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8rem_8rem] sm:px-6">
                <span className="min-w-0 pr-3 font-semibold leading-snug">{feature.label}</span>
                <span className="text-center leading-snug text-muted">{feature.free}</span>
                <span className="text-center font-bold leading-snug text-accent-text">{feature.plus}</span>
              </div>
            ))}
          </div>
        </div>

        <section className="relative overflow-hidden rounded-2xl border-2 border-accent bg-surface p-6 shadow-[0_22px_60px_-42px_var(--flame-500)] sm:p-8" aria-labelledby="plus-plan-title">
          <div className="flex items-start justify-between gap-4 sm:items-center">
            <div className="min-w-0">
              <span className="inline-flex rounded-lg bg-accent-soft px-3 py-1 text-xs font-black tracking-wider text-accent-text">
                {copy.badge}
              </span>
              <h2 id="plus-plan-title" className="mt-3 text-2xl font-black tracking-[-0.025em]">
                {copy.productName}
              </h2>
            </div>
            <p className="shrink-0 text-right">
              <span className="block whitespace-nowrap text-2xl font-black tracking-tight sm:text-3xl">{copy.pricing.monthly}</span>
              <span className="block text-sm text-muted">{copy.pricing.perMonth}</span>
            </p>
          </div>

          <ul className="mt-7 divide-y divide-border border-y border-border">
            {copy.pricing.features.slice(1).map((feature) => (
              <li key={feature.label} className="flex gap-3 py-3 text-sm leading-relaxed sm:text-base">
                <span aria-hidden className="font-black text-accent-text">✓</span>
                <span><strong>{feature.label}</strong> · {feature.plus}</span>
              </li>
            ))}
          </ul>

          {checkoutEnabled ? (
            <>
              {/* 결제는 호스팅 결제창으로의 리다이렉트다. 어느 제공자(Unifi Pay·Latpeed)를
                  쓸지는 서버가 환경변수로 정하므로 프론트는 하나의 폼만 유지한다.
                  JS 없이도 동작하는 순수 form POST. */}
              <form
                action="/api/billing/checkout"
                method="post"
                className="mt-7"
                onSubmit={() => {
                  track("plus_checkout_started", { locale, surface: "pricing" });
                  track("checkout_start", { locale, surface: "pricing" });
                }}
              >
                <input type="hidden" name="locale" value={locale} />
                <button type="submit" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-strong px-5 text-base font-bold text-white shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
                  {copy.pricing.checkout}
                </button>
              </form>
              <ol className="mt-5 space-y-2 text-sm leading-relaxed text-muted" aria-label={copy.pricing.checkout}>
                {copy.pricing.paymentSteps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span aria-hidden className="font-bold text-accent-text">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <Link
                href={localizedStaticPath("/explore", locale)}
                className="mt-5 flex min-h-11 items-center justify-center text-center text-sm font-semibold text-accent-text underline underline-offset-4 hover:text-foreground"
              >
                {copy.pricing.freeExplore}
              </Link>
            </>
          ) : (
            <div className="mt-7">
              <button
                type="button"
                disabled
                className="flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-xl bg-surface-2 px-5 text-base font-bold text-muted"
              >
                {copy.pricing.checkout}
              </button>
              <p className="mt-3 text-center text-sm font-medium text-muted" role="status">
                {CHECKOUT_UNAVAILABLE[locale]}
              </p>
            </div>
          )}
          <p className="mt-3 text-center text-sm text-muted">{copy.pricing.launchNote}</p>
          <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-sm leading-relaxed text-muted">
            {copy.pricing.sameEmail}
          </p>
        </section>
      </section>

      {fairyMinimumAmount !== undefined && <FairySupportOption minimumAmount={fairyMinimumAmount} />}

      <PlusFeatures features={copy.pricing.features} heading={copy.pricing.featuresTitle} />

      <p className="mt-12 text-center text-sm text-muted">
        <Link href={localizedStaticPath("/", locale)} className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground">
          MemeCatch
        </Link>
      </p>
    </main>
  );
}
