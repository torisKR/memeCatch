import type { Metadata, Viewport } from "next";
import { RootDocument } from "@/app/_root/root-document";
import {
  ROOT_VIEWPORT,
  SHARED_ROOT_METADATA,
} from "@/app/_root/metadata";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import {
  SEO_ROUTE_LOCALES,
  toOpenGraphLocale,
} from "@/lib/i18n-routing";
import "../globals.css";

export const metadata: Metadata = {
  ...SHARED_ROOT_METADATA,
  title: {
    default: "밈캐치 — 밈의 뜻과 트렌드를 한눈에",
    template: "%s | 밈캐치",
  },
  description:
    "밈·유행어·챌린지의 뜻과 유래, 사용 맥락을 확인하세요. 최근 정리한 밈과 근거가 확인된 확산 소식을 구분해 보여드립니다.",
  applicationName: "밈캐치",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "밈캐치",
  },
  openGraph: {
    type: "website",
    title: "밈캐치 — 밈의 뜻과 트렌드를 한눈에",
    description:
      "밈의 뜻·유래·사용 맥락과 확인된 확산 근거를 한곳에서 살펴보세요.",
    siteName: "밈캐치",
    locale: "ko_KR",
    alternateLocale: SEO_ROUTE_LOCALES.filter((locale) => locale !== "ko").map(
      toOpenGraphLocale,
    ),
  },
};

export const viewport: Viewport = ROOT_VIEWPORT;

export default function KoreanRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RootDocument locale={DEFAULT_LOCALE}>{children}</RootDocument>;
}
