import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { RootDocument } from "@/app/_root/root-document";
import {
  ROOT_VIEWPORT,
  SHARED_ROOT_METADATA,
} from "@/app/_root/metadata";
import { buildLocalizedMetadata } from "@/lib/i18n-routing";
import { OG_PAGE_LOCALES, isOgPageLocale } from "@/lib/og-default-image";
import "../globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return OG_PAGE_LOCALES.map((locale) => ({ locale }));
}

// Only the prebuilt share locales are valid localized document roots.
export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isOgPageLocale(locale)) return { robots: { index: false, follow: false } };

  return {
    ...SHARED_ROOT_METADATA,
    ...buildLocalizedMetadata({
      locale,
      pathname: "/",
    }),
    ...(locale === "ar" ? { robots: { index: false, follow: false } } : {}),
  };
}

export const viewport: Viewport = ROOT_VIEWPORT;

export default async function LocalizedLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isOgPageLocale(locale)) notFound();

  return <RootDocument locale={locale}>{children}</RootDocument>;
}
