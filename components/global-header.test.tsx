import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigation } = vi.hoisted(() => ({
  navigation: { pathname: "/" },
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/auth-menu", () => ({
  AuthMenu: () => <a href="/login">로그인</a>,
  HideOnAdmin: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/explore-nav-link", () => ({
  ExploreNavLink: () => <a href="/explore">탐색</a>,
}));

vi.mock("@/components/brand-mark", () => ({
  BrandTile: () => <span aria-hidden />,
}));

vi.mock("@/components/random-meme-button", () => ({
  RandomMemeButton: () => <button type="button">랜덤</button>,
}));

vi.mock("@/lib/i18n-client", async (importOriginal) => {
  const { getMessages } = await import("@/lib/i18n");
  const original = await importOriginal<typeof import("@/lib/i18n-client")>();

  return {
    ...original,
    persistLocale: vi.fn(),
    useLocale: () => ({ locale: "ko", messages: getMessages("ko") }),
  };
});

import { GlobalHeader } from "@/components/global-header";

describe("GlobalHeader", () => {
  beforeEach(() => {
    navigation.pathname = "/";
  });

  it("hides the wordmark below 480px while preserving the labelled home link", () => {
    const html = renderToStaticMarkup(<GlobalHeader />);
    const homeLink = html.match(
      /<a[^>]*aria-label="밈캐치 홈"[^>]*>.*?<\/a>/,
    )?.[0];
    const wordmark = homeLink?.match(
      /<span class="[^"]*"><span class="text-lg font-extrabold tracking-\[-0\.045em\]">밈캐치<\/span>/,
    )?.[0];

    expect(homeLink).toContain('aria-label="밈캐치 홈"');
    expect(homeLink).toContain("min-w-11");
    expect(wordmark).toContain("hidden");
    expect(wordmark).toContain("min-[480px]:flex");
    expect(wordmark).toContain("shrink-0");
    expect(wordmark).toContain("whitespace-nowrap");
  });

  // 언어 선택기는 본문 번역이 존재하는 라우트(/news, /products)에서만 노출된다.
  it("shows the compact locale label on translated routes without clipping the native language control", () => {
    navigation.pathname = "/news";
    const html = renderToStaticMarkup(<GlobalHeader />);
    const desktopSearch = html.match(/<form[^>]*role="search"[^>]*>/)?.[0];
    const compactSearch = html.match(/<a[^>]*href="\/search"[^>]*>/)?.[0];
    const languageControl = html.match(
      /<label class="relative[^\"]*"[^>]*>.*?<select[^>]*aria-label="언어 선택"[^>]*>.*?<\/select>.*?<\/label>/,
    )?.[0];
    const languageSelect = languageControl?.match(
      /<select[^>]*aria-label="언어 선택"[^>]*>/,
    )?.[0];

    expect(desktopSearch).toContain("hidden lg:block");
    expect(compactSearch).toContain("lg:hidden");
    expect(languageControl).toContain("min-w-[4.75rem]");
    expect(languageControl).toContain(">KO</span>");
    expect(languageSelect).toContain("absolute inset-0 h-full w-full");
    expect(languageSelect).toContain("opacity-0");
    expect(languageControl).not.toMatch(/(?:^|\s)(?:md:)?w-11(?:\s|\")/);
  });

  // 홈·밈 상세·탐색 등 본문이 한국어 고정인 페이지에서는 선택기를 숨긴다
  // (H5: 번역 커버리지 확보 전까지 opt-in 노출만 허용).
  it.each(["/", "/explore", "/memes/some-meme", "/search"])(
    "hides the language selector on untranslated route %s",
    (pathname) => {
      navigation.pathname = pathname;
      const html = renderToStaticMarkup(<GlobalHeader />);

      expect(html).not.toContain('aria-label="언어 선택"');
    },
  );

  it.each(["/news", "/products", "/products/some-item"])(
    "shows the language selector on translated route %s",
    (pathname) => {
      navigation.pathname = pathname;
      const html = renderToStaticMarkup(<GlobalHeader />);

      expect(html).toContain('aria-label="언어 선택"');
    },
  );
});
