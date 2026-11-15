import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const queries = vi.hoisted(() => ({
  getMemeByShortId: vi.fn(),
}));
const translations = vi.hoisted(() => ({
  getAvailableTranslationLocales: vi.fn(),
  getLocalizedMemeByShortId: vi.fn(),
}));

vi.mock("@/lib/queries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queries")>();
  return { ...actual, getMemeByShortId: queries.getMemeByShortId };
});

vi.mock("@/lib/meme-translations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meme-translations")>();
  return {
    ...actual,
    getAvailableTranslationLocales: translations.getAvailableTranslationLocales,
    getLocalizedMemeByShortId: translations.getLocalizedMemeByShortId,
  };
});

import { generateMetadata as generateKoreanMemeMetadata } from "@/app/(default)/memes/[key]/page";
import { generateMetadata as generateLocalizedMemeMetadata } from "@/app/[locale]/memes/[key]/page";
import { GET as localeImage } from "@/app/[locale]/memes/[key]/opengraph-image/route";
import { loadKoreanShareCard } from "@/lib/meme-share-content";
import { isGenericShareImageUrl, koreanMemeShareImage, localeMemeShareImage, localeShareVersion, shareCacheVersion } from "@/lib/meme-share-image";
import { renderOgDefaultImage } from "@/lib/og-default-card";
import { curatedShareVersion } from "@/lib/share-version";

const HOME_TITLE = "밈캐치 — 그 밈, 3초 안에 알려드려요";

function databaseMeme() {
  return {
    id: "db-1",
    short_id: "zzdb0001",
    slug: "database-only",
    title: "데이터베이스밈",
    summary: "요약문",
    description: "이 밈이 어떻게 쓰이는지 설명하는 문장입니다.",
    origin: "방송에서 시작된 유래입니다.",
    origin_kind: null,
    usage_note: null,
    caution: null,
    aliases: [],
    usage_examples: [],
    meme_sources: [],
    meme_contents: [],
    meme_tags_map: [],
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function imageTags(metadata: { openGraph?: unknown; twitter?: unknown }): {
  og: { url: string; alt: string }[];
  twitter: { url: string; alt: string }[];
} {
  const openGraph = metadata.openGraph && !Array.isArray(metadata.openGraph)
    ? metadata.openGraph
    : undefined;
  const twitter = metadata.twitter && !Array.isArray(metadata.twitter)
    ? metadata.twitter
    : undefined;
  const read = (images: unknown): { url: string; alt: string }[] => {
    if (!Array.isArray(images)) return [];
    return images.map((image) => {
      if (typeof image === "string") return { url: image, alt: "" };
      if (image && typeof image === "object" && "url" in image) {
        const alt = "alt" in image ? String(image.alt ?? "") : "";
        return { url: String(image.url), alt };
      }
      return { url: "", alt: "" };
    });
  };
  const graph = openGraph as { images?: unknown } | undefined;
  const tw = twitter as { images?: unknown } | undefined;
  return { og: read(graph?.images), twitter: read(tw?.images) };
}

function expectMemeCard(
  metadata: { openGraph?: unknown; twitter?: unknown },
  url: string,
  alt: string,
) {
  const images = imageTags(metadata);
  expect(images.og.map((item) => item.url)).toEqual([url]);
  expect(images.twitter.map((item) => item.url)).toEqual([url]);
  expect(images.og.map((item) => item.alt)).toEqual([alt]);
  expect(images.twitter.map((item) => item.alt)).toEqual([alt]);
  expect(images.og.filter((item) => isGenericShareImageUrl(item.url))).toEqual([]);
  expect(images.twitter.filter((item) => isGenericShareImageUrl(item.url))).toEqual([]);
  expect(url.startsWith("https://")).toBe(true);
}

function localizedMeme() {
  const original = databaseMeme();
  return {
    ...original,
    title: "Database meme",
    summary: "A reviewed summary",
    description: "A reviewed description of the meme.",
    origin: "A reviewed origin of the meme.",
    slug: "database-only",
    original: {
      slug: original.slug,
      title: original.title,
      summary: original.summary,
      description: original.description,
      origin: original.origin,
      usage_note: null,
      caution: null,
      aliases: [],
    },
    translation: {
      locale: "en",
      status: "reviewed",
      localizedSlug: "database-only",
      sourceUpdatedAt: original.updated_at,
      updatedAt: original.updated_at,
      isCurrent: true,
      provider: "editorial",
      model: "human",
      promptVersion: 1,
      translatedAt: original.updated_at,
      reviewedAt: original.updated_at,
    },
  };
}

describe("meme detail share tags survive the known mutants", () => {
  it("keeps the database Korean title and image", async () => {
    queries.getMemeByShortId.mockResolvedValue(databaseMeme());
    translations.getAvailableTranslationLocales.mockResolvedValue([]);
    translations.getLocalizedMemeByShortId.mockResolvedValue(null);

    const metadata = await generateKoreanMemeMetadata({
      params: Promise.resolve({ key: "zzdb0001-database-only" }),
    });

    expect(metadata.title).toBe("데이터베이스밈 뜻");
    expect(metadata.title).not.toBe(HOME_TITLE);
    expect(metadata.openGraph).toMatchObject({
      title: "데이터베이스밈 뜻",
      url: "/memes/zzdb0001-database-only",
    });
    expectMemeCard(
      metadata,
      koreanMemeShareImage({
        shortId: "zzdb0001",
        slug: "database-only",
        alt: "데이터베이스밈",
        version: shareCacheVersion({ timestamps: [databaseMeme().updated_at] }),
      }).url,
      "데이터베이스밈",
    );
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      title: "데이터베이스밈 뜻",
    });
    expect(metadata.twitter).not.toMatchObject({ title: HOME_TITLE });
  });

  it("keeps one translated meme card when a translation exists", async () => {
    translations.getLocalizedMemeByShortId.mockResolvedValue(localizedMeme());
    translations.getAvailableTranslationLocales.mockResolvedValue([]);

    const metadata = await generateLocalizedMemeMetadata({
      params: Promise.resolve({ locale: "en", key: "zzdb0001-database-only" }),
    });

    expect(metadata.openGraph).toMatchObject({ title: "Database meme · Meaning" });
    expectMemeCard(
      metadata,
      localeMemeShareImage({
        locale: "en",
        shortId: "zzdb0001",
        slug: "database-only",
        alt: "Database meme",
        version: localeShareVersion({
          updated_at: databaseMeme().updated_at,
          translationUpdatedAt: databaseMeme().updated_at,
        }),
      }).url,
      "Database meme",
    );
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("keeps an untranslated locale page on main's not-found", async () => {
    queries.getMemeByShortId.mockResolvedValue(databaseMeme());
    translations.getLocalizedMemeByShortId.mockResolvedValue(null);
    translations.getAvailableTranslationLocales.mockResolvedValue([]);
    for (const locale of ["en", "ja", "zh", "zh-tw", "ar"] as const) {
      await expect(generateLocalizedMemeMetadata({
        params: Promise.resolve({ locale, key: "zzdb0001-database-only" }),
      })).rejects.toMatchObject({ digest: expect.stringMatching(/404$/) });
    }
  });

  it("changes the image URL when updated_at moves inside the same second", async () => {
    const first = databaseMeme();
    const early = new Date("2026-11-14T02:45:04.100Z");
    const later = new Date("2026-11-14T02:45:04.900Z");
    expect(early.getUTCSeconds()).toBe(later.getUTCSeconds());
    queries.getMemeByShortId.mockResolvedValue({ ...first, updated_at: early });
    translations.getAvailableTranslationLocales.mockResolvedValue([]);
    translations.getLocalizedMemeByShortId.mockResolvedValue(null);
    const before = await generateKoreanMemeMetadata({
      params: Promise.resolve({ key: "zzdb0001-database-only" }),
    });
    queries.getMemeByShortId.mockResolvedValue({ ...first, updated_at: later });
    const after = await generateKoreanMemeMetadata({
      params: Promise.resolve({ key: "zzdb0001-database-only" }),
    });
    const beforeUrl = imageTags(before).og[0]?.url ?? "";
    const afterUrl = imageTags(after).og[0]?.url ?? "";
    expect(new URL(beforeUrl).searchParams.get("v")).toBe(String(early.getTime()));
    expect(new URL(afterUrl).searchParams.get("v")).toBe(String(later.getTime()));
    expect(new URL(beforeUrl).searchParams.get("v")).not.toMatch(/GMT|Sat/);
    expect(beforeUrl).not.toBe(afterUrl);
    expect(imageTags(before).twitter[0]?.url).toBe(beforeUrl);
    expect(imageTags(after).twitter[0]?.url).toBe(afterUrl);
  });

  it("changes the locale image URL when only the translation is edited", async () => {
    const first = localizedMeme();
    translations.getLocalizedMemeByShortId.mockResolvedValue(first);
    translations.getAvailableTranslationLocales.mockResolvedValue([]);
    const before = await generateLocalizedMemeMetadata({
      params: Promise.resolve({ locale: "en", key: "zzdb0001-database-only" }),
    });
    const later = new Date("2026-01-01T00:00:00.800Z");
    expect(later.getUTCSeconds()).toBe(new Date(first.updated_at).getUTCSeconds());
    translations.getLocalizedMemeByShortId.mockResolvedValue({
      ...first,
      translation: { ...first.translation, updatedAt: later },
    });
    const after = await generateLocalizedMemeMetadata({
      params: Promise.resolve({ locale: "en", key: "zzdb0001-database-only" }),
    });
    const beforeUrl = imageTags(before).og[0]?.url ?? "";
    const afterUrl = imageTags(after).og[0]?.url ?? "";
    expect(beforeUrl).toContain(String(new Date(first.updated_at).getTime()));
    expect(afterUrl).toContain(String(later.getTime()));
    expect(afterUrl).not.toBe(beforeUrl);
    expect(imageTags(after).twitter[0]?.url).toBe(afterUrl);
  });

  it("changes ?v when only the representative image URL changes", async () => {
    const first = localizedMeme();
    const earlyPhoto = {
      ...first,
      meme_contents: [{
        thumbnail_url: "/ai-memes/early.png",
        url: null,
        is_representative: true,
        moderation_status: "approved",
        availability: "live",
        created_at: first.updated_at,
      }],
    };
    translations.getLocalizedMemeByShortId.mockResolvedValue(earlyPhoto);
    translations.getAvailableTranslationLocales.mockResolvedValue([]);
    const before = await generateLocalizedMemeMetadata({
      params: Promise.resolve({ locale: "en", key: "zzdb0001-database-only" }),
    });
    translations.getLocalizedMemeByShortId.mockResolvedValue({
      ...earlyPhoto,
      meme_contents: [{ ...earlyPhoto.meme_contents[0], thumbnail_url: "/ai-memes/later.png" }],
    });
    const after = await generateLocalizedMemeMetadata({
      params: Promise.resolve({ locale: "en", key: "zzdb0001-database-only" }),
    });
    const beforeUrl = imageTags(before).og[0]?.url ?? "";
    const afterUrl = imageTags(after).og[0]?.url ?? "";
    const beforeVersion = new URL(beforeUrl).searchParams.get("v");
    const afterVersion = new URL(afterUrl).searchParams.get("v");
    expect(beforeVersion).toMatch(/^\d+$/);
    expect(afterVersion).toMatch(/^\d+$/);
    expect(beforeVersion).not.toBe(String(new Date(first.updated_at).getTime()));
    expect(beforeVersion).not.toBe(afterVersion);
  });

  it("prefers a database row over a curated seed with the same short id", async () => {
    queries.getMemeByShortId.mockResolvedValue({
      ...databaseMeme(),
      short_id: "bjk2021k",
      slug: "bun-jo-ka",
      title: "디비분좋카",
    });
    const card = await loadKoreanShareCard("bjk2021k-bun-jo-ka");
    expect(card?.title).toBe("디비분좋카");
  });

  it("serves /og/en when a curated meme has no translation", async () => {
    translations.getLocalizedMemeByShortId.mockResolvedValue(null);
    const response = await localeImage(
      new Request("http://localhost/en/memes/bjk2021k-bun-jo-ka/opengraph-image"),
      { params: Promise.resolve({ locale: "en", key: "bjk2021k-bun-jo-ka" }) },
    );
    const expected = await renderOgDefaultImage("en");
    const body = Buffer.from(await response.arrayBuffer());
    expect(response.status).toBe(200);
    expect(body.equals(Buffer.from(await expected.arrayBuffer()))).toBe(true);
  });

  it("keeps curated ?v a decimal that changes with the copy and the image", () => {
    const meme = {
      title: "분좋카 (분위기 좋은 카페)",
      summary: "감각적인 인테리어",
      origin_year: 2021,
      category: "phrase",
    };
    const version = curatedShareVersion(meme);
    expect(version).toMatch(/^\d+$/);
    expect(version).not.toMatch(/[a-f]/i);
    expect(curatedShareVersion({ ...meme, summary: "다른 뜻" })).not.toBe(version);
    expect(curatedShareVersion(meme, "/ai-memes/bun.png")).not.toBe(version);
    expect(curatedShareVersion(meme, "/ai-memes/bun.png")).not.toBe(
      curatedShareVersion(meme, "/ai-memes/other.png"),
    );
  });

  it("does not publish a Korean curated title when the translation is missing", async () => {
    queries.getMemeByShortId.mockResolvedValue(null);
    translations.getLocalizedMemeByShortId.mockResolvedValue(null);
    for (const locale of ["en", "ja"] as const) {
      await expect(generateLocalizedMemeMetadata({
        params: Promise.resolve({ locale, key: "bjk2021k-bun-jo-ka" }),
      })).rejects.toMatchObject({ digest: expect.stringMatching(/404$/) });
    }
  });
});
