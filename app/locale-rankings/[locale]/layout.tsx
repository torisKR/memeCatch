import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { RootDocument } from "@/app/_root/root-document";
import { ROOT_VIEWPORT, SHARED_ROOT_METADATA } from "@/app/_root/metadata";
import { isLocale, type Locale } from "@/lib/i18n";
import "../../globals.css";

export const metadata: Metadata = SHARED_ROOT_METADATA;
export const viewport: Viewport = ROOT_VIEWPORT;

/**
 * Prefixed rankings URLs (`/en/rankings`, `/ar/rankings`, …) are rewritten here.
 * Korean stays on `/rankings`. This root is separate so an unknown prefix
 * cannot opt the Korean segment into another language.
 */
export default async function LocaleRankingsLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale) || locale === "ko") notFound();
  return <RootDocument locale={locale as Locale}>{children}</RootDocument>;
}
