import type { Metadata, Viewport } from "next";
import { RootDocument } from "@/app/_root/root-document";
import {
  ROOT_VIEWPORT,
  SHARED_ROOT_METADATA,
} from "@/app/_root/metadata";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES, getSeoCopy } from "@/lib/i18n-routing";
import { ogDefaultImageDescriptor } from "@/lib/og-default-image";
import "../globals.css";

export const metadata: Metadata = {
  ...SHARED_ROOT_METADATA,
  title: {
    default: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    template: "%s | 밈캐치",
  },
  // 홈·기본 설명. 110~160자(Bing "메타 설명이 너무 짧음" 대응), 한국어 SEO 문구와 같은 값.
  description: getSeoCopy("ko").description,
  applicationName: "밈캐치",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "밈캐치",
  },
  openGraph: {
    type: "website",
    title: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    description: getSeoCopy("ko").description,
    siteName: "밈캐치",
    locale: "ko_KR",
    alternateLocale: KOREAN_OPEN_GRAPH_ALTERNATE_LOCALES,
    images: [ogDefaultImageDescriptor("ko")],
  },
  twitter: {
    card: "summary_large_image",
    images: [ogDefaultImageDescriptor("ko")],
  },
};

export const viewport: Viewport = ROOT_VIEWPORT;

export default function KoreanRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <RootDocument locale={DEFAULT_LOCALE}>
      {children}
    </RootDocument>
  );
}
