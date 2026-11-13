import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const translations = vi.hoisted(() => ({
  getLocalizedMemeByShortId: vi.fn(),
  getAvailableTranslationLocales: vi.fn(),
}));

vi.mock("@/lib/meme-translations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/meme-translations")>();
  return {
    ...actual,
    getLocalizedMemeByShortId: translations.getLocalizedMemeByShortId,
    getAvailableTranslationLocales: translations.getAvailableTranslationLocales,
  };
});

import { generateMetadata as generateLocalizedMemeMetadata } from "@/app/[locale]/memes/[key]/page";
import { generateMetadata as generateLocalizedNotFoundMetadata } from "@/app/[locale]/not-found";
import { metadata as koreanNotFoundMetadata } from "@/app/(default)/not-found";

const LOCALES = ["en", "ja", "zh", "zh-tw"] as const;

function imageUrls(images: unknown): string[] {
  if (!Array.isArray(images)) return [];
  return images.map((image) => {
    if (typeof image === "string") return image;
    if (image && typeof image === "object" && "url" in image) return String(image.url);
    return "";
  });
}

describe("untranslated locale detail share images", () => {
  it("uses one locale card for both tags when the catalog has no translation", async () => {
    translations.getLocalizedMemeByShortId.mockResolvedValue(null);
    translations.getAvailableTranslationLocales.mockResolvedValue([]);

    for (const locale of LOCALES) {
      await expect(generateLocalizedMemeMetadata({
        params: Promise.resolve({ locale, key: "bjk2021k-bun-jo-ka" }),
      })).rejects.toMatchObject({ digest: expect.stringMatching(/404$/) });

      const metadata = await generateLocalizedNotFoundMetadata({
        params: Promise.resolve({ locale }),
      });
      const openGraph = metadata.openGraph && !Array.isArray(metadata.openGraph)
        ? metadata.openGraph
        : undefined;
      const twitter = metadata.twitter && !Array.isArray(metadata.twitter)
        ? metadata.twitter
        : undefined;
      const ogUrls = imageUrls(openGraph?.images);
      const twitterUrls = imageUrls(twitter?.images);

      expect(metadata.title).toBe(koreanNotFoundMetadata.title);
      expect(metadata.robots).toEqual({ index: false, follow: true });
      expect(ogUrls).toEqual([`/og/${locale}`]);
      expect(twitterUrls).toEqual([`/og/${locale}`]);
      expect(ogUrls).toEqual(twitterUrls);
      expect(ogUrls.join(" ")).not.toContain("opengraph-image");
    }
  });
});
