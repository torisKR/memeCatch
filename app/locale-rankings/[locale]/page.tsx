import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RankingsScreen, generateRankingsMetadata } from "@/app/rankings/page";
import { isLocale } from "@/lib/i18n";

/**
 * Request-time, same as `/rankings`. A database-less build must not store
 * the fallback HTML for the revalidate window of a static page.
 */
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "ko") return { robots: { index: false, follow: false } };
  return generateRankingsMetadata(locale);
}

export default async function LocaleRankingsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "ko") notFound();
  return <RankingsScreen locale={locale} />;
}
