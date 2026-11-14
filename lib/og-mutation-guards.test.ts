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
import { isGenericShareImageUrl, koreanMemeShareImage, localeMemeShareImage } from "@/lib/meme-share-image";

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
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function imageUrls(metadata: { openGraph?: unknown; twitter?: unknown }): { og: string[]; twitter: string[] } {
  const openGraph = metadata.openGraph && !Array.isArray(metadata.openGraph)
    ? metadata.openGraph
    : undefined;
  const twitter = metadata.twitter && !Array.isArray(metadata.twitter)
    ? metadata.twitter
    : undefined;
  const read = (images: unknown): string[] => {
    if (!Array.isArray(images)) return [];
    return images.map((image) => {
      if (typeof image === "string") return image;
      if (image && typeof image === "object" && "url" in image) return String(image.url);
      return "";
    });
  };
  const graph = openGraph as { images?: unknown } | undefined;
  const tw = twitter as { images?: unknown } | undefined;
  return { og: read(graph?.images), twitter: read(tw?.images) };
}

function expectMemeCard(metadata: { openGraph?: unknown; twitter?: unknown }, url: string) {
  const images = imageUrls(metadata);
  expect(images.og).toEqual([url]);
  expect(images.twitter).toEqual([url]);
  expect(images.og.filter((item) => isGenericShareImageUrl(item))).toEqual([]);
  expect(images.twitter.filter((item) => isGenericShareImageUrl(item))).toEqual([]);
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
      koreanMemeShareImage("zzdb0001", "database-only", "데이터베이스밈").url,
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
      localeMemeShareImage("en", "zzdb0001", "database-only", "Database meme").url,
    );
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  });

  it("uses the Korean meme card for an untranslated locale page when the meme exists", async () => {
    queries.getMemeByShortId.mockResolvedValue(databaseMeme());
    translations.getLocalizedMemeByShortId.mockResolvedValue(null);
    translations.getAvailableTranslationLocales.mockResolvedValue([]);
    const card = koreanMemeShareImage("zzdb0001", "database-only", "데이터베이스밈").url;

    for (const locale of ["en", "ja", "zh", "zh-tw", "ar"] as const) {
      const metadata = await generateLocalizedMemeMetadata({
        params: Promise.resolve({ locale, key: "zzdb0001-database-only" }),
      });
      expect(metadata.title).toBe("데이터베이스밈");
      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(metadata.openGraph).toMatchObject({
        title: "데이터베이스밈",
        url: locale === "ar"
          ? "/ar/memes/zzdb0001-database-only"
          : `/${locale}/memes/zzdb0001-database-only`,
      });
      expectMemeCard(metadata, card);
      expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: "데이터베이스밈" });
    }
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
