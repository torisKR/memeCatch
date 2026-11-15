import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Metadata } from "next";

vi.mock("server-only", () => ({}));

import { metadata as homeMetadata } from "@/app/(default)/page";
import { metadata as globalMetadata } from "@/app/(default)/global/page";
import { metadata as studioMetadata } from "@/app/(default)/studio/page";
import { metadata as memeCardsMetadata } from "@/app/(default)/meme-cards/page";
import { metadata as supportMetadata } from "@/app/(default)/support/page";
import { metadata as communityMetadata } from "@/app/(default)/community/page";
import { metadata as communityNewMetadata } from "@/app/(default)/community/new/page";
import { metadata as contactMetadata } from "@/app/(default)/contact/page";
import { metadata as editorialMetadata } from "@/app/(default)/editorial/page";
import { metadata as newsMetadata } from "@/app/(default)/news/page";
import { metadata as searchMetadata } from "@/app/(default)/search/page";
import { metadata as privacyMetadata } from "@/app/(default)/privacy/page";
import { metadata as termsMetadata } from "@/app/(default)/terms/page";
import { metadata as originalsMetadata } from "@/app/(default)/originals/page";
import { metadata as exploreMetadata } from "@/app/(default)/explore/page";
import { metadata as quizMetadata } from "@/app/(default)/quiz/page";
import { metadata as weeklyMetadata } from "@/app/(default)/weekly/page";
import { metadata as collectionsMetadata } from "@/app/(default)/collections/page";
import { metadata as pricingMetadata } from "@/app/(default)/pricing/page";
import { metadata as dailyMetadata } from "@/app/(default)/daily/page";
import { metadata as layoutMetadata } from "@/app/(default)/layout";
import { generateMetadata as generateAboutMetadata } from "@/app/(default)/about/page";
import { generateMetadata as generateCollectionMetadata } from "@/app/(default)/collections/[slug]/page";
import { generateMetadata as generateEditionMetadata } from "@/app/(default)/originals/edition/[slug]/page";
import { generateMetadata as generateLocaleHomeMetadata } from "@/app/[locale]/page";
import { generateMetadata as generateLocalePricingMetadata } from "@/app/[locale]/pricing/page";
import { generateMetadata as generateLocaleSearchMetadata } from "@/app/[locale]/search/page";
import { generateMetadata as generateLocaleDailyMetadata } from "@/app/[locale]/daily/page";
import { generateMetadata as generateLocaleMemeCardsMetadata } from "@/app/[locale]/meme-cards/page";
import { generateMetadata as generateKoreanMemeMetadata } from "@/app/(default)/memes/[key]/page";
import { COLLECTIONS } from "@/lib/collections";
import { CURATED_CORE_MEMES } from "@/lib/curated-memes";
import { EDITORIAL_ORIGINALS } from "@/lib/editorial-originals";
import { OG_PAGE_LOCALES } from "@/lib/og-default-image";
import { SEO_CONTENT_LOCALES, localizePath } from "@/lib/i18n-routing";

function canonicalOf(metadata: Metadata): string | undefined {
  const alternates = metadata.alternates;
  if (!alternates || Array.isArray(alternates)) return undefined;
  return typeof alternates.canonical === "string" ? alternates.canonical : undefined;
}

function expectOwnUrl(metadata: Metadata, pathname: string) {
  const openGraph = metadata.openGraph;
  expect(canonicalOf(metadata)).toBe(pathname);
  expect(openGraph && !Array.isArray(openGraph) ? openGraph.url : undefined).toBe(pathname);
  const images = openGraph && !Array.isArray(openGraph) ? openGraph.images : undefined;
  expect(Array.isArray(images) ? images.length : 0).toBeGreaterThan(0);
}

function pageFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return pageFiles(path);
    return entry === "page.tsx" ? [path] : [];
  });
}

describe("og:url matches each page canonical", () => {
  it("does not let the Korean layout hand every child the home url", () => {
    const openGraph = layoutMetadata.openGraph;
    expect(openGraph && !Array.isArray(openGraph) ? openGraph : {}).not.toHaveProperty("url");
    expect(openGraph).toMatchObject({
      images: [{ url: "/og/ko", width: 1200, height: 630 }],
    });
  });

  it("sets the home card on / and each formerly inherited Korean page", () => {
    expectOwnUrl(homeMetadata, "/");
    expect(homeMetadata.openGraph).toMatchObject({ locale: "ko_KR" });
    expectOwnUrl(globalMetadata, "/global");
    expectOwnUrl(studioMetadata, "/studio");
    expectOwnUrl(memeCardsMetadata, "/meme-cards");
    expectOwnUrl(communityMetadata, "/community");
    expectOwnUrl(communityNewMetadata, "/community/new");
    expectOwnUrl(contactMetadata, "/contact");
    expectOwnUrl(editorialMetadata, "/editorial");
    expectOwnUrl(newsMetadata, "/news");
    expectOwnUrl(searchMetadata, "/search");
    expectOwnUrl(privacyMetadata, "/privacy");
    expectOwnUrl(termsMetadata, "/terms");
    expectOwnUrl(originalsMetadata, "/originals");
    expectOwnUrl(supportMetadata, "/support");
    expectOwnUrl(exploreMetadata, "/explore");
    expectOwnUrl(quizMetadata, "/quiz");
    expectOwnUrl(weeklyMetadata, "/weekly");
    expectOwnUrl(collectionsMetadata, "/collections");
    expectOwnUrl(pricingMetadata, "/pricing");
    expectOwnUrl(dailyMetadata, "/daily");
  });

  it("keeps generated Korean and locale cards on their own canonical", async () => {
    expectOwnUrl(await generateAboutMetadata(), "/about");
    for (const collection of COLLECTIONS) {
      expectOwnUrl(
        await generateCollectionMetadata({ params: Promise.resolve({ slug: collection.slug }) }),
        `/collections/${collection.slug}`,
      );
    }
    for (const edition of EDITORIAL_ORIGINALS) {
      expectOwnUrl(
        await generateEditionMetadata({ params: Promise.resolve({ slug: edition.slug }) }),
        `/originals/edition/${edition.slug}`,
      );
    }
    for (const meme of CURATED_CORE_MEMES) {
      expectOwnUrl(
        await generateKoreanMemeMetadata({
          params: Promise.resolve({ key: `${meme.short_id}-${meme.slug}` }),
        }),
        `/memes/${meme.short_id}-${meme.slug}`,
      );
    }
    for (const locale of OG_PAGE_LOCALES) {
      expectOwnUrl(
        await generateLocaleHomeMetadata({ params: Promise.resolve({ locale }) }),
        localizePath("/", locale),
      );
      expectOwnUrl(
        await generateLocalePricingMetadata({ params: Promise.resolve({ locale }) }),
        localizePath("/pricing", locale),
      );
    }
    for (const locale of SEO_CONTENT_LOCALES) {
      expectOwnUrl(
        await generateLocaleSearchMetadata({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({}),
        }),
        localizePath("/search", locale),
      );
      expectOwnUrl(
        await generateLocaleDailyMetadata({ params: Promise.resolve({ locale }) }),
        localizePath("/daily", locale),
      );
      expectOwnUrl(
        await generateLocaleMemeCardsMetadata({
          params: Promise.resolve({ locale }),
          searchParams: Promise.resolve({}),
        }),
        localizePath("/meme-cards", locale),
      );
    }
  });

  it("requires every public canonical page to set its own openGraph url and image", () => {
    const offenders = pageFiles("app").filter((path) => {
      if (path.includes("/admin/") || path.includes("/(admin)/")) return false;
      const source = readFileSync(path, "utf8");
      if (!source.includes("canonical:")) return false;
      const setsUrl = source.includes("url:") || source.includes("buildLocalizedMetadata") || source.includes("koreanPageShare");
      const setsImage = source.includes("images:") || source.includes("buildLocalizedMetadata") || source.includes("koreanPageShare");
      return !setsUrl || !setsImage;
    });
    expect(offenders).toEqual([]);
  });
});
