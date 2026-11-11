import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const queryMocks = vi.hoisted(() => ({
  getRecentlyPublishedMemes: vi.fn(),
  getLocalizedFeaturedMemes: vi.fn(),
}));

vi.mock("@/lib/queries", () => ({
  getRecentlyPublishedMemes: queryMocks.getRecentlyPublishedMemes,
}));

vi.mock("@/lib/meme-translations", () => ({
  getLocalizedFeaturedMemes: queryMocks.getLocalizedFeaturedMemes,
}));

vi.mock("@/lib/meme-art.server", () => ({
  loadMemeArtUrls: vi.fn(async () => new Map()),
  loadMemeArtByShortId: vi.fn(async () => null),
}));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("not-found");
  },
}));

vi.mock("@/components/adsense-script", () => ({
  AdsenseScript: () => <script data-adsense-loader="korean-home" />,
}));

vi.mock("@/components/home/home-scene", () => ({
  HomeScene: ({ label }: { label?: string }) => <figure data-home-scene>{label}</figure>,
}));

vi.mock("@/components/usage-guide", () => ({
  SafetySignalGuide: ({ locale }: { locale?: string }) => (
    <section data-signal-guide={locale}>Four usage signals</section>
  ),
}));

import KoreanHome, { metadata as koreanMetadata } from "@/app/(default)/page";
import LocalizedHome, { generateMetadata } from "@/app/[locale]/page";

function koreanEntry(id: string, title: string) {
  return {
    id,
    short_id: id,
    slug: `entry-${id}`,
    title,
    summary: `${title} summary`,
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "active",
    media_type: "text",
    origin_year: 2026,
    trend_score: 0,
  };
}

function localizedEntry(id: string, title: string, updatedAt: string) {
  return {
    ...koreanEntry(id, title),
    original: {
      slug: `original-${id}`,
      title: `원문 ${id}`,
      summary: "원문 요약",
      description: "원문 설명",
      origin: "원문 유래",
      usage_note: null,
      caution: null,
      aliases: [],
    },
    translation: { updatedAt },
  };
}

describe("home route rendering", () => {
  beforeEach(() => {
    queryMocks.getRecentlyPublishedMemes.mockReset();
    queryMocks.getLocalizedFeaturedMemes.mockReset();
  });

  it("server-renders Korean search, legitimate content, signals, and the existing ad loader", async () => {
    queryMocks.getRecentlyPublishedMemes.mockResolvedValue([
      koreanEntry("ABC123", "공개된 최신 밈"),
    ]);

    const html = renderToStaticMarkup(await KoreanHome());

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('action="/search"');
    expect(html).toContain("공개된 최신 밈");
    expect(queryMocks.getRecentlyPublishedMemes).toHaveBeenCalledWith(8);
    expect(html).toContain('href="/explore"');
    expect(html).toContain("지금 뜨는 밈");
    expect(html).toContain('data-safety-icon="green"');
    expect(html).toContain('data-signal-guide="ko"');
    expect(html).toContain('data-adsense-loader="korean-home"');
    expect(html.match(/type="application\/ld\+json"/g)).toHaveLength(2);
  });

  it.each(["en", "ja", "zh", "zh-tw"] as const)(
    "server-renders the same localized structure with published %s records",
    async (locale) => {
      queryMocks.getLocalizedFeaturedMemes.mockResolvedValue([
        localizedEntry("OLD001", `${locale} older`, "2026-09-01T00:00:00.000Z"),
        localizedEntry("NEW001", `${locale} newer`, "2026-09-20T00:00:00.000Z"),
      ]);

      const html = renderToStaticMarkup(
        await LocalizedHome({ params: Promise.resolve({ locale }) }),
      );

      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html).toContain(`action="/${locale}/search"`);
      expect(html).toContain(`data-signal-guide="${locale}"`);
      expect(html).toContain(`${locale} newer`);
      expect(html.indexOf(`${locale} newer`)).toBeLessThan(html.indexOf(`${locale} older`));
      expect(html).toContain("원문 NEW001");
      expect(html).toContain(`href="/${locale}/explore"`);
      expect(html).toContain('data-safety-icon="green"');
      expect(html).toContain('type="application/ld+json"');
    },
  );

  it("keeps Korean and localized canonical/hreflang metadata", async () => {
    expect(koreanMetadata.alternates).toEqual({
      canonical: "/",
      languages: {
        ko: "/",
        en: "/en",
        ja: "/ja",
        "zh-Hans": "/zh",
        "zh-Hant": "/zh-tw",
        "x-default": "/en",
      },
    });

    const localizedMetadata = await generateMetadata({
      params: Promise.resolve({ locale: "ja" }),
    });
    expect(localizedMetadata.alternates).toEqual({
      canonical: "/ja",
      languages: {
        ko: "/",
        en: "/en",
        ja: "/ja",
        "zh-Hans": "/zh",
        "zh-Hant": "/zh-tw",
        "x-default": "/en",
      },
    });
  });
});
