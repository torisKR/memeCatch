import type { Metadata, Viewport } from "next";
import { RootDocument } from "@/app/_root/root-document";
import {
  ROOT_VIEWPORT,
  SHARED_ROOT_METADATA,
} from "@/app/_root/metadata";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import {
  SEO_ROUTE_LOCALES,
  buildHreflangLanguages,
  toOpenGraphLocale,
} from "@/lib/i18n-routing";
import "../globals.css";

export const metadata: Metadata = {
  ...SHARED_ROOT_METADATA,
  title: {
    default: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    template: "%s | 밈캐치",
  },
  description:
    "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지. 한국 밈의 실시간 사전, 밈캐치.",
  applicationName: "밈캐치",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "밈캐치",
  },
  alternates: {
    canonical: "/",
    languages: {
      ...buildHreflangLanguages("/", SEO_ROUTE_LOCALES),
      // 해외 주 타깃 전환(루프 048): x-default = 영어 홈. 밈 상세는 en 번역
      // reviewed 문서가 생길 때까지 ko 유지(placeholder를 가리키면 유해).
      "x-default": "/en",
    },
  },
  openGraph: {
    type: "website",
    title: "밈캐치 — 그 밈, 3초 안에 알려드려요",
    description:
      "뜻·유래부터 지금 써도 되는지까지. 한국 밈을 3초 안에 따라잡아요.",
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
