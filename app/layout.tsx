import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import { GlobalHeader } from "@/components/global-header";
import { PwaInstall } from "@/components/pwa-install";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

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
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-dvh pb-16 md:pb-0">
        <GlobalHeader />
        {children}
        <BottomNav />
        <PwaInstall />
      </body>
    </html>
  );
}
