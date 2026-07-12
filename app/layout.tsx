import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { GoogleAnalytics } from "@next/third-parties/google";
import { BottomNav } from "@/components/bottom-nav";
import { GlobalHeader } from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import { PwaInstall } from "@/components/pwa-install";
import { OrganizationJsonLd } from "@/components/json-ld";
import { LocaleDocumentSync, LocaleProvider } from "@/lib/i18n-client";
import { getDocumentLanguage } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/i18n-server";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// AdSense — env(ca-pub-…)가 설정된 경우에만 사이트 소유확인 메타 + 스크립트 활성화
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
// GA4 — env(G-…)가 설정된 경우에만 로드 (AdSense·서치콘솔 연동용 분석)
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

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
      "naver-site-verification": [
        "4973421614cb5e3682ed4c99e6deee5c66b1f587",
        "86e27030ca82a4577a7a16ed1ac0a70799c029ec",
      ],
      ...(ADSENSE_CLIENT ? { "google-adsense-account": ADSENSE_CLIENT } : {}),
    },
  },
  openGraph: {
    type: "website",
    title: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    description:
      "뜻·유래부터 지금 써도 되는지까지. 한국 밈을 3초 안에 따라잡아요.",
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Intentional request-time boundary: pathless locale selection must vary the
  // document and shared chrome per request, so document routes skip Full Route Cache.
  const locale = await getRequestLocale();

  return (
    <html lang={getDocumentLanguage(locale)}>
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
      <body className="flex min-h-dvh flex-col pb-16 md:pb-0">
        <LocaleProvider initialLocale={locale}>
          <LocaleDocumentSync />
          {/* AdSense — 심사·게재 공통 스크립트 (env 설정 시에만 로드) */}
          {ADSENSE_CLIENT && (
            <Script
              id="adsense"
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
              crossOrigin="anonymous"
              strategy="afterInteractive"
            />
          )}
          {/* GA4 — @next/third-parties 공식 통합 (env 설정 시에만 로드) */}
          {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
          <OrganizationJsonLd />
          <GlobalHeader />
          <div className="flex-1">{children}</div>
          <SiteFooter />
          <BottomNav />
          <PwaInstall />
        </LocaleProvider>
      </body>
    </html>
  );
}
