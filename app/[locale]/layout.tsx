import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { RootDocument } from "@/app/_root/root-document";
import {
  ROOT_VIEWPORT,
  SHARED_ROOT_METADATA,
} from "@/app/_root/metadata";
import {
  SEO_CONTENT_LOCALES,
  buildLocalizedMetadata,
  isSeoContentLocale,
} from "@/lib/i18n-routing";
import "../globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return SEO_CONTENT_LOCALES.map((locale) => ({ locale }));
}

// Allow ISR to regenerate a prerendered home after catalog tags expire.
// With dynamicParams=false, Next 16.3 discards the expired entry then throws
// NoFallbackError, making every localized home 404 until the process restarts.
// LocalizedLayout still rejects unsupported locales below (including Arabic).
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };

  return {
    ...SHARED_ROOT_METADATA,
    ...buildLocalizedMetadata({
      locale,
      pathname: "/",
    }),
  };
}

export const viewport: Viewport = ROOT_VIEWPORT;

export default async function LocalizedLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();

  return <RootDocument locale={locale}>{children}</RootDocument>;
}
