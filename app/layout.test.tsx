import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { getMessages } from "@/lib/i18n";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/components/auth-menu", () => ({
  AuthMenu: () => null,
  HideOnAdmin: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/korean-rankings.server", () => ({
  koreanRankingsVisible: async () => true,
}));

import KoreanRootLayout, { metadata as koreanMetadata } from "@/app/(default)/layout";
import LocalizedRootLayout, {
  dynamicParams,
  generateMetadata as generateLocalizedMetadata,
  generateStaticParams,
} from "@/app/[locale]/layout";

describe("multiple root layouts", () => {
  it("does not render the Coupang banner or its reserved space", async () => {
    const html = renderToStaticMarkup(
      await KoreanRootLayout({ children: <main>content</main> }),
    );
    expect(html).not.toContain("coupang.com");
    expect(html).not.toContain("h-[131px]");
    expect(html).not.toContain("md:h-[151px]");
  });
  it("정적 기본 로케일(ko) 문서를 서버 렌더한다 — ISR 유지", async () => {
    const messages = getMessages("ko");

    const html = renderToStaticMarkup(
      await KoreanRootLayout({ children: <main>content</main> }),
    );

    expect(html).toMatch(/^<html lang="ko" dir="ltr">/);
    expect(html).toContain(`aria-label="${messages.home}"`);
    // 언어 선택기는 전 라우트 상시 노출 — 첫 방문은 LocaleAutoDetect가
    // 브라우저 언어로 자동 설정하고, 수동 변경은 쿠키로 유지된다.
    expect(html).toContain(`aria-label="${messages.languageMenu}"`);
    expect(html).toContain(`aria-label="${messages.footerNav}"`);
    expect(html).toContain(`aria-label="${messages.mainNav}"`);
    expect(html).toContain(`>${messages.about}</a>`);
    // 편집 원칙(E-E-A-T 신뢰 문서)은 전 페이지 푸터에서 도달 가능해야 한다.
    expect(html).toContain(`>${messages.editorial}</a>`);
    expect(html).toContain('href="/contact"');
    expect(html).toContain(">문의</a>");
    expect(html).toContain('href="/rankings"');
    expect(koreanMetadata.twitter).toEqual({
      card: "summary_large_image",
      images: [{ url: "/og/ko", width: 1200, height: 630, alt: "밈캐치 — 그 밈, 3초 안에 알려드려요", type: "image/png" }],
    });
    expect(koreanMetadata.openGraph).toMatchObject({
      locale: "ko_KR",
      images: [{ url: "/og/ko", width: 1200, height: 630, alt: "밈캐치 — 그 밈, 3초 안에 알려드려요", type: "image/png" }],
    });
    expect(koreanMetadata.openGraph).not.toHaveProperty("url");
  });

  // 예전 푸터는 모바일용 <details>와 데스크톱용 <div>에 같은 고지 문단을
  // 각각 렌더하고 CSS로 한쪽만 보여줬다. 화면에는 하나만 보여도 HTML에는
  // 두 벌이 담겨, 크롤러·심사 도구에는 같은 문단이 연속 2회 반복되는
  // 중복 텍스트로 읽혔다. 고지는 문서에 정확히 한 번만 나와야 한다.
  it("운영·저작권 고지를 문서에 한 번만 출력한다", async () => {
    const messages = getMessages("ko");

    const html = renderToStaticMarkup(
      await KoreanRootLayout({ children: <main>content</main> }),
    );

    expect(html.split(messages.legal1).length - 1).toBe(1);
    expect(html.split(messages.legal2).length - 1).toBe(1);
  });

  it.each([
    ["en", "en"],
    ["ja", "ja"],
    ["zh", "zh-Hans"],
    ["zh-tw", "zh-Hant"],
  ] as const)("/%s의 원본 HTML 언어를 %s로 정적 렌더한다", async (locale, lang) => {
    const messages = getMessages(locale);
    const document = await LocalizedRootLayout({
      children: <main>localized</main>,
      params: Promise.resolve({ locale }),
    });
    const html = renderToStaticMarkup(document);

    expect(html).toMatch(new RegExp(`^<html lang="${lang}" dir="ltr">`));
    expect(html).toContain(`aria-label="${messages.home}"`);
    expect(html).toContain(`aria-label="${messages.languageMenu}"`);
    expect(html).not.toContain("locale-document-bootstrap");
  });

  it("모든 외국어 루트를 정적 생성하고 공통 PWA·소유권 메타데이터를 보존한다", async () => {
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual([
      { locale: "en" },
      { locale: "ja" },
      { locale: "zh" },
      { locale: "zh-tw" },
      { locale: "ar" },
    ]);

    const metadata = await generateLocalizedMetadata({
      children: null,
      params: Promise.resolve({ locale: "en" }),
    });

    expect(metadata.manifest).toBe("/manifest.webmanifest");
    expect(metadata.verification).toBeDefined();
    expect(metadata.alternates?.canonical).toBe("/en");

    const arabic = await generateLocalizedMetadata({
      children: null,
      params: Promise.resolve({ locale: "ar" }),
    });
    expect(arabic.robots).toEqual({ index: false, follow: false });
    expect(arabic.alternates?.canonical).toBe("/ar");
    expect(arabic.openGraph).toMatchObject({
      locale: "ar_AR",
      url: "/ar",
      images: [{ url: "/og/ar", width: 1200, height: 630 }],
    });
  });
});
