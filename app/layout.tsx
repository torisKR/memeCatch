import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { BottomNav } from "@/components/bottom-nav";
import { GlobalHeader } from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import { PwaInstall } from "@/components/pwa-install";
import { OrganizationJsonLd } from "@/components/json-ld";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
// AdSense — env(ca-pub-…)가 설정된 경우에만 사이트 소유확인 메타 + 스크립트 활성화
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    template: "%s | 밈캐치",
  },
  description:
    "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지. 한국 밈의 실시간 사전, 밈캐치.",
  applicationName: "밈캐치",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "밈캐치" },
  // 홈(루트) canonical — 하위 페이지는 각자 generateMetadata에서 설정
  alternates: { canonical: "/" },
  // 검색엔진 사이트 소유확인 — 구글 서치콘솔 + 네이버 서치어드바이저 (+ AdSense 계정 연결)
  verification: {
    google: "tNpEvRKUbirAkwRA-XH0HJzDh8bCF6Waqctqu1Hak38",
    other: {
      "naver-site-verification": "4973421614cb5e3682ed4c99e6deee5c66b1f587",
      ...(ADSENSE_CLIENT ? { "google-adsense-account": ADSENSE_CLIENT } : {}),
    },
  },
  openGraph: {
    type: "website",
    siteName: "밈캐치",
    locale: "ko_KR",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcfa" },
    { media: "(prefers-color-scheme: dark)", color: "#131316" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="preconnect"
          href="https://cdn.jsdelivr.net"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-dvh pb-16 md:pb-0">
        {/* AdSense — 심사·게재 공통 스크립트 (env 설정 시에만 로드) */}
        {ADSENSE_CLIENT && (
          <Script
            id="adsense"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <OrganizationJsonLd />
        <GlobalHeader />
        {children}
        <SiteFooter />
        <BottomNav />
        <PwaInstall />
      </body>
    </html>
  );
}
