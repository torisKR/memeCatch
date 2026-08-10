import type { Metadata } from "next";
import { GlobalDailyPage, dailyContentLocaleFrom } from "@/components/premium/global-daily-page";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { getRequestLocale } from "@/lib/i18n-server";
import { GLOBAL_DAILY_COPY } from "@/lib/global-daily-challenge-copy";
import { SEO_ROUTE_LOCALES, buildLocalizedMetadata } from "@/lib/i18n-routing";

const copy = GLOBAL_DAILY_COPY.ko;

export const metadata: Metadata = {
  ...buildLocalizedMetadata({
    locale: "ko",
    pathname: "/daily",
    title: copy.title,
    description: copy.intro,
    availableLocales: SEO_ROUTE_LOCALES,
  }),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DailyPage() {
  const [entitlement, requestLocale] = await Promise.all([
    getPremiumEntitlement(),
    getRequestLocale(),
  ]);
  return (
    <GlobalDailyPage
      locale={dailyContentLocaleFrom(requestLocale)}
      displayLocale={requestLocale}
      signedIn={entitlement.signedIn}
      isPremium={entitlement.isPremium}
    />
  );
}
