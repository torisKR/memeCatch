import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SEO_CONTENT_LOCALES,
  SEO_LOCALE_CONFIG,
  buildLocalizedMetadata,
  isSeoContentLocale,
} from "@/lib/i18n-routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return SEO_CONTENT_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  return buildLocalizedMetadata({
    locale,
    pathname: "/",
    availableLocales: ["ko", ...SEO_CONTENT_LOCALES],
  });
}

export default async function LocalizedLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();

  const config = SEO_LOCALE_CONFIG[locale];
  return (
    <div lang={config.documentLanguage} dir={config.direction} className="contents">
      {children}
    </div>
  );
}
