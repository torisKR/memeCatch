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

  it("keeps a compact wordmark and labelled home link on every viewport", () => {
    const html = renderToStaticMarkup(<GlobalHeader />);
    const homeLink = html.match(
      /<a[^>]*aria-label="밈캐치 홈"[^>]*>.*?<\/a>/,
    )?.[0];
    const wordmark = homeLink?.match(
      /<span class="[^"]*font-extrabold tracking-\[-0\.045em\][^"]*">밈캐치<\/span>/,
    )?.[0];

    expect(homeLink).toContain('aria-label="밈캐치 홈"');
    expect(homeLink).toContain("min-h-11");
    expect(wordmark).not.toContain("hidden");
    expect(wordmark).toContain("shrink-0");
    expect(wordmark).toContain("whitespace-nowrap");
    expect(homeLink).not.toContain("catchmeme.com");
  });

  it("keeps search available without showing secondary controls in the primary bar", () => {
    navigation.pathname = "/news";
    const html = renderToStaticMarkup(<GlobalHeader />);
    const desktopSearch = html.match(/<form[^>]*role="search"[^>]*>/)?.[0];
    const compactSearch = html.match(/<a[^>]*href="\/search"[^>]*>/)?.[0];

    expect(desktopSearch).toContain("hidden lg:block");
    expect(compactSearch).toContain("lg:hidden");
    expect(html).not.toContain('href="/submit"');
    expect(html).not.toContain("source=alert_briefing_setup");
  });

  it("keeps the header on one row with two direct discovery destinations", () => {
    const html = renderToStaticMarkup(<GlobalHeader />);
    const compactSearch = html.match(/<a[^>]*href="\/search"[^>]*>/)?.[0];
    const discoveryNav = html.match(/<nav[^>]*aria-label="주요 발견"[^>]*>.*?<\/nav>/)?.[0];
    const discoveryLinks = [
      ...(discoveryNav ?? "").matchAll(
        /<a[^>]*href="(?:\/|\/explore\?sort=recent)"[^>]*>/g,
      ),
    ].map(([link]) => link);

    expect(html).toContain("flex-nowrap");
    expect(compactSearch).toContain("h-11 w-11 shrink-0");
    expect(discoveryNav).toContain("shrink-0");
    expect(discoveryLinks).toHaveLength(2);
    for (const link of discoveryLinks) {
      expect(link).toContain("min-h-11");
      expect(link).toContain("shrink-0");
      expect(link).toContain("whitespace-nowrap");
    }
  });

  it("marks explore active on nested explore routes", () => {
    navigation.pathname = "/explore/topics";
    const html = renderToStaticMarkup(<GlobalHeader />);

    expect(html.match(/<a href="\/explore\?sort=recent" aria-current="page"/)).toBeTruthy();
  });
});
