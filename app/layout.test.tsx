import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getMessages, type Locale } from "@/lib/i18n";

const { getRequestLocale } = vi.hoisted(() => ({
  getRequestLocale: vi.fn<() => Promise<Locale>>(),
}));

vi.mock("@/lib/i18n-server", () => ({ getRequestLocale }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/components/auth-menu", () => ({
  AuthMenu: () => null,
  HideOnAdmin: ({ children }: { children: React.ReactNode }) => children,
}));

import RootLayout from "@/app/layout";

describe("RootLayout", () => {
  beforeEach(() => {
    getRequestLocale.mockResolvedValue("ko");
  });

  it.each([
    ["ko", "ko"],
    ["en", "en"],
    ["ja", "ja"],
    ["zh", "zh-Hans"],
  ] satisfies [Locale, string][])(
    "server-renders the %s document language as %s",
    async (locale, documentLanguage) => {
      getRequestLocale.mockResolvedValue(locale);
      const messages = getMessages(locale);

      const html = renderToStaticMarkup(
        await RootLayout({ children: <main>content</main> }),
      );

      expect(html).toMatch(
        new RegExp(`^<html lang="${documentLanguage}">`),
      );
      expect(html).toContain(`aria-label="${messages.home}"`);
      expect(html).toContain(`aria-label="${messages.languageMenu}"`);
      expect(html).toContain(`aria-label="${messages.footerNav}"`);
      expect(html).toContain(`aria-label="${messages.mainNav}"`);
      expect(html).toContain(`>${messages.about}</a>`);
    },
  );
});
