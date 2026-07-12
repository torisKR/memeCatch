import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
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
  it("keeps fixed-width search and language controls compact below the large breakpoint", () => {
    const html = renderToStaticMarkup(<GlobalHeader />);
    const desktopSearch = html.match(/<form[^>]*role="search"[^>]*>/)?.[0];
    const compactSearch = html.match(/<a[^>]*href="\/search"[^>]*>/)?.[0];
    const languageSelect = html.match(/<select[^>]*aria-label="언어 선택"[^>]*>/)?.[0];
    const languageChevron = html.match(/<span aria-hidden="true"[^>]*>▼<\/span>/)?.[0];

    expect(desktopSearch).toContain("hidden lg:block");
    expect(compactSearch).toContain("lg:hidden");
    expect(languageSelect).toContain("lg:w-auto");
    expect(languageSelect).toContain("lg:pr-7");
    expect(languageChevron).toContain("lg:block");
  });
});
