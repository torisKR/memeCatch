import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PricingContent } from "@/components/premium/pricing-content";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { getFairyConfig } from "@/lib/billing/fairy.server";
import {
  SEO_ROUTE_LOCALES,
  buildLocalizedMetadata,
  isSeoContentLocale,
} from "@/lib/i18n-routing";

type Props = { params: Promise<{ locale: string }> };

/**
 * The global landing routes are static, indexable conversion pages. Keep them
 * separate from the cookie-localized Korean `/pricing` page so each SEO locale
 * receives matching HTML language, canonical URL, and share metadata.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  const copy = PREMIUM_COPY[locale].pricing;
  return buildLocalizedMetadata({
    locale,
    pathname: "/pricing",
    title: `MemeCatch Plus — ${copy.title}`,
    description: copy.intro,
    availableLocales: SEO_ROUTE_LOCALES,
  });
}

export default async function LocalizedPricingPage({ params }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();

  const checkoutEnabled = process.env.UNIFI_PAY_CHECKOUT_ENABLED?.trim() === "true";
  return (
    <PricingContent
      checkoutEnabled={checkoutEnabled}
      fairyMinimumAmount={getFairyConfig()?.minimumAmount}
    />
  );
}
