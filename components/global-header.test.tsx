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
  AuthMenu: () => <span>로그인</span>,
  HideOnAdmin: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/explore-nav-link", () => ({
  ExploreNavLink: () => <span>탐색</span>,
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

  // 브랜드명은 모바일에서도 항상 노출한다(신규 방문자 브랜드 인지 — 외부 디자인
  // 검수 반영). 도메인 서브라벨(catchmeme.com)만 sm+에서 노출.
  it("shows the wordmark on all viewports while preserving the labelled home link", () => {
    const html = renderToStaticMarkup(<GlobalHeader />);
    const homeLink = html.match(
      /<a[^>]*aria-label="밈캐치 홈"[^>]*>.*?<\/a>/,
    )?.[0];
    const wordmark = homeLink?.match(
      /<span class="[^"]*"><span class="text-lg font-extrabold tracking-\[-0\.045em\]">밈캐치<\/span>/,
    )?.[0];

    expect(homeLink).toContain('aria-label="밈캐치 홈"');
    expect(homeLink).toContain("min-w-11");
    expect(wordmark).not.toContain("hidden");
    expect(wordmark).toContain("shrink-0");
    expect(wordmark).toContain("whitespace-nowrap");
    expect(homeLink).toContain("sm:block"); // 도메인 서브라벨은 sm+만
  });

  // 언어 선택기는 전 라우트 상시 노출 — 첫 방문은 LocaleAutoDetect가 자동 감지.
  it("shows the compact locale label without clipping the native language control", () => {
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
    expect(languageControl).toContain("min-w-[5.25rem]");
    expect(languageControl).toContain(">KO</span>");
    expect(languageSelect).toContain("absolute inset-0 h-full w-full");
    expect(languageSelect).toContain("opacity-0");
    expect(languageControl).not.toMatch(/(?:^|\s)(?:md:)?w-11(?:\s|\")/);
  });

  // 선택기는 전 라우트에 노출한다 — 미번역 로케일은 en(zh-tw는 zh) 폴백 렌더.
  it.each(["/", "/explore", "/memes/some-meme", "/search", "/news", "/products", "/pricing", "/premium", "/my"])(
    "shows the language selector on route %s",
    (pathname) => {
      navigation.pathname = pathname;
      const html = renderToStaticMarkup(<GlobalHeader />);

      expect(html).toContain('aria-label="언어 선택"');
    },
  );
});
