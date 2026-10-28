import type { ComponentPropsWithoutRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const queryMocks = vi.hoisted(() => ({
  getEditorialHomeMemes: vi.fn(),
  getLocalizedFeaturedMemesResult: vi.fn(),
}));

vi.mock("@/lib/home-editorial.server", () => ({
  getEditorialHomeMemes: queryMocks.getEditorialHomeMemes,
}));

vi.mock("@/lib/meme-translations", () => ({
  getLocalizedFeaturedMemesResult: queryMocks.getLocalizedFeaturedMemesResult,
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

vi.mock("@/components/home/home-scene", () => ({
  HomeScene: ({ label }: { label?: string }) => <figure data-home-scene>{label}</figure>,
}));

vi.mock("@/components/usage-guide", () => ({
  SafetySignalGuide: ({ locale }: { locale?: string }) => (
    <section data-signal-guide={locale}>Four usage signals</section>
  ),
}));

import KoreanHome, { generateMetadata as generateKoreanMetadata } from "@/app/(default)/page";
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
    queryMocks.getEditorialHomeMemes.mockReset();
    queryMocks.getLocalizedFeaturedMemesResult.mockReset();
  });

  it("server-renders Korean search and editorial content without promotional sections or an ad loader", async () => {
    queryMocks.getEditorialHomeMemes.mockResolvedValue({
      status: "ready",
      items: [koreanEntry("ABC123", "공개된 최신 밈")],
    });

    const html = renderToStaticMarkup(await KoreanHome());

    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain('action="/search"');
    expect(html).toContain("공개된 최신 밈");
    expect(queryMocks.getEditorialHomeMemes).toHaveBeenCalledWith(6);
    expect(html).toContain('href="/explore"');
    expect(html).toContain('data-safety-icon="green"');
    expect(html).toContain("출처와 설명을 갖춘 밈");
    expect(html).not.toContain('data-home-section="pathways"');
    expect(html).not.toContain('data-home-section="editorial-trust"');
    expect(html).not.toContain("data-home-artwork");
    expect(html).not.toContain("adsbygoogle");
    expect(html).not.toContain("data-adsense-loader");
    expect(html.match(/type="application\/ld\+json"/g)).toHaveLength(2);
  });

  it("renders real empty and temporary unavailability as different Korean states", async () => {
    queryMocks.getEditorialHomeMemes.mockResolvedValueOnce({ status: "ready", items: [] });
    const emptyHtml = renderToStaticMarkup(await KoreanHome());

    expect(emptyHtml).toContain('data-home-recommendations="empty"');
    expect(emptyHtml).toContain("현재 편집 추천 기준을 통과한 공개 항목이 없습니다.");
    expect(emptyHtml).not.toContain('data-home-recommendations="unavailable"');

    queryMocks.getEditorialHomeMemes.mockResolvedValueOnce({
      status: "unavailable",
      items: [],
    });
    const unavailableHtml = renderToStaticMarkup(await KoreanHome());

    expect(unavailableHtml).toContain('data-home-recommendations="unavailable"');
    expect(unavailableHtml).toContain("추천 항목을 불러오지 못했습니다.");
    expect(unavailableHtml).not.toContain('data-home-recommendations="empty"');
    expect(unavailableHtml).not.toContain("표시할 추천 항목이 없어요");
  });

  it.each(["en", "ja", "zh", "zh-tw"] as const)(
    "server-renders the same localized structure with published %s records",
    async (locale) => {
      queryMocks.getLocalizedFeaturedMemesResult.mockResolvedValue({
        status: "active",
        items: [
          localizedEntry("OLD001", `${locale} older`, "2026-09-01T00:00:00.000Z"),
          localizedEntry("NEW001", `${locale} newer`, "2026-09-20T00:00:00.000Z"),
        ],
      });

      const html = renderToStaticMarkup(
        await LocalizedHome({ params: Promise.resolve({ locale }) }),
      );

      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html).toContain(`action="/${locale}/search"`);
      expect(html).toContain(`${locale} newer`);
      expect(html.indexOf(`${locale} newer`)).toBeLessThan(html.indexOf(`${locale} older`));
      expect(html).toContain("원문 NEW001");
      expect(html).toContain(`href="/${locale}/explore"`);
      expect(html).toContain('data-safety-icon="green"');
      expect(html).not.toContain("data-home-artwork");
      expect(html).toContain('type="application/ld+json"');
    },
  );

  it("noindexes a localized home with no reviewed current coverage", async () => {
    queryMocks.getLocalizedFeaturedMemesResult.mockResolvedValue({
      status: "coverage-empty",
      items: [],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "ja" }),
    });
    const html = renderToStaticMarkup(
      await LocalizedHome({ params: Promise.resolve({ locale: "ja" }) }),
    );

    expect(metadata.alternates).toEqual({ canonical: "/ja" });
    expect(metadata.robots).toEqual({ index: false, follow: true });
    expect(html).toContain('data-home-recommendations="empty"');
  });

  it("fails localized metadata and rendering when coverage loading is unavailable", async () => {
    queryMocks.getLocalizedFeaturedMemesResult.mockResolvedValue({
      status: "unavailable",
      items: [],
    });

    await expect(generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    })).rejects.toThrow("[localized-home] translation coverage unavailable: en");
    await expect(LocalizedHome({
      params: Promise.resolve({ locale: "en" }),
    })).rejects.toThrow("[localized-home] translation coverage unavailable: en");
  });

  it("keeps Korean and localized canonical/hreflang metadata", async () => {
    queryMocks.getLocalizedFeaturedMemesResult.mockImplementation(async (locale) =>
      locale === "en" || locale === "ja"
        ? {
            status: "active",
            items: [localizedEntry(`${locale}001`, `${locale} entry`, "2026-09-20T00:00:00.000Z")],
          }
        : { status: "coverage-empty", items: [] },
    );
    const koreanMetadata = await generateKoreanMetadata();
    expect(koreanMetadata.alternates).toEqual({
      canonical: "/",
      languages: {
        ko: "/",
        en: "/en",
        ja: "/ja",
        "x-default": "/",
      },
    });

    const localizedMetadata = await generateMetadata({
      params: Promise.resolve({ locale: "ja" }),
    });
    expect(localizedMetadata.alternates).toEqual({
      canonical: "/ja",
      languages: {
        ko: "/",
        ja: "/ja",
        "x-default": "/",
      },
    });
  });

  it("keeps the Korean home usable while omitting unverifiable foreign alternates", async () => {
    queryMocks.getLocalizedFeaturedMemesResult.mockResolvedValue({
      status: "unavailable",
      items: [],
    });

    const metadata = await generateKoreanMetadata();

    expect(metadata.alternates).toEqual({
      canonical: "/",
      languages: { ko: "/", "x-default": "/" },
    });
    expect(metadata.robots).toBeUndefined();
  });

  it("keeps valid sibling alternates when one root coverage lookup throws unexpectedly", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    queryMocks.getLocalizedFeaturedMemesResult.mockImplementation(async (locale) => {
      if (locale === "en") throw new Error("provider details must stay private");
      if (locale === "ja") {
        return {
          status: "active",
          items: [localizedEntry("JA002", "ja valid", "2026-09-20T00:00:00.000Z")],
        };
      }
      return { status: "coverage-empty", items: [] };
    });

    const metadata = await generateKoreanMetadata();

    expect(metadata.alternates?.languages).toEqual({
      ko: "/",
      ja: "/ja",
      "x-default": "/",
    });
    expect(warn).toHaveBeenCalledWith("localized_home_coverage_unavailable", "en");
    expect(warn.mock.calls.flat().join(" ")).not.toContain("provider details");
    warn.mockRestore();
  });
});
