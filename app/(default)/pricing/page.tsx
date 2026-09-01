import type { Metadata } from "next";
import { PricingContent } from "@/components/premium/pricing-content";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { SEO_ROUTE_LOCALES, buildLocalizedMetadata } from "@/lib/i18n-routing";

const copy = PREMIUM_COPY.ko.pricing;

export const metadata: Metadata = buildLocalizedMetadata({
  locale: "ko",
  pathname: "/pricing",
  title: `MemeCatch Plus — ${copy.title}`,
  description: copy.intro,
  availableLocales: SEO_ROUTE_LOCALES,
});

export default function PricingPage() {
  const checkoutEnabled = process.env.UNIFI_PAY_CHECKOUT_ENABLED?.trim() === "true";
  return <PricingContent checkoutEnabled={checkoutEnabled} />;
}
