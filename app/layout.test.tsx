import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Locale } from "@/lib/i18n";

const { getRequestLocale } = vi.hoisted(() => ({
  getRequestLocale: vi.fn<() => Promise<Locale>>(),
}));

vi.mock("@/lib/i18n-server", () => ({ getRequestLocale }));
vi.mock("@/lib/i18n-client", () => ({
  LocaleDocumentSync: ({ locale }: { locale: Locale }) => (
    <span data-synced-locale={locale} />
  ),
}));
vi.mock("@/components/bottom-nav", () => ({ BottomNav: () => null }));
vi.mock("@/components/global-header", () => ({ GlobalHeader: () => null }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/pwa-install", () => ({ PwaInstall: () => null }));
vi.mock("@/components/json-ld", () => ({ OrganizationJsonLd: () => null }));
vi.mock("next/script", () => ({ default: () => null }));
vi.mock("@next/third-parties/google", () => ({ GoogleAnalytics: () => null }));

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

      const html = renderToStaticMarkup(
        await RootLayout({ children: <main>content</main> }),
      );

      expect(html).toMatch(
        new RegExp(`^<html lang="${documentLanguage}">`),
      );
      expect(html).toContain(`data-synced-locale="${locale}"`);
    },
  );
});
