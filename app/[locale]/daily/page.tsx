import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GlobalDailyPage } from "@/components/premium/global-daily-page";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { GLOBAL_DAILY_COPY } from "@/lib/global-daily-challenge-copy";
import {
  SEO_ROUTE_LOCALES,
  buildLocalizedMetadata,
  isSeoContentLocale,
} from "@/lib/i18n-routing";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };
  const copy = GLOBAL_DAILY_COPY[locale];
  return {
    ...buildLocalizedMetadata({
      locale,
      pathname: "/daily",
      title: copy.title,
      description: copy.intro,
      availableLocales: SEO_ROUTE_LOCALES,
    }),
    robots: { index: false, follow: false },
  };
}

export default async function LocalizedDailyPage({ params }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();
  const entitlement = await getPremiumEntitlement();
  return (
    <GlobalDailyPage
      locale={locale}
      displayLocale={locale}
      signedIn={entitlement.signedIn}
      isPremium={entitlement.isPremium}
    />
  );
}
