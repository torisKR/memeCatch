import { createHash } from "node:crypto";
import { createElement } from "react";
import { ImageResponse } from "next/og";
import { describe, expect, it, vi } from "vitest";
import { ogImageCacheControl, renderMemeShareCard, SHARE_CARD_FALLBACK_CACHE_CONTROL } from "@/lib/meme-share-card";
import { renderOgDefaultImage } from "@/lib/og-default-card";

vi.mock("server-only", () => ({}));

import { GET as koreanImage } from "@/app/(default)/memes/[key]/opengraph-image-k2cx9c/route";
import { GET as localeImage } from "@/app/[locale]/memes/[key]/opengraph-image/route";
import { loadKoreanShareCard } from "@/lib/meme-share-content";
import * as shareContent from "@/lib/meme-share-content";
import * as memeTranslations from "@/lib/meme-translations";
import { findCuratedByShareKey, shareKeyParts } from "@/lib/curated-memes";

async function pngBytes(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  return Buffer.from(await response.arrayBuffer());
}

function sha256(body: Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

describe("legacy per-meme image routes", () => {
  it("parses year-style curated keys by short id and hyphenated slug", () => {
    expect(shareKeyParts("bjk2021k-bun-jo-ka")).toEqual({
      shortId: "bjk2021k",
      slug: "bun-jo-ka",
    });
    expect(shareKeyParts("okk2020k-eok-kka")).toEqual({
      shortId: "okk2020k",
      slug: "eok-kka",
    });
    expect(shareKeyParts("%62jk2021k-bun-jo-ka").shortId).toBe("bjk2021k");
    expect(findCuratedByShareKey("bjk2021k-bun-jo-ka")?.title).toContain("분좋카");
    expect(findCuratedByShareKey("okk2020k-eok-kka")?.title).toContain("억까");
    expect(findCuratedByShareKey("wrongid-bun-jo-ka")?.slug).toBe("bun-jo-ka");
    expect(findCuratedByShareKey("not-a-real-meme")).toBeNull();
  });

  it("renders curated titles for bjk2021k and okk2020k, and /og/ko for an unknown key", async () => {
    const [missing, bun, eok, fallback] = await Promise.all([
      koreanImage(new Request("http://localhost/memes/not-a-real-meme/opengraph-image-k2cx9c"), {
        params: Promise.resolve({ key: "not-a-real-meme" }),
      }),
      koreanImage(new Request("http://localhost/memes/bjk2021k-bun-jo-ka/opengraph-image-k2cx9c"), {
        params: Promise.resolve({ key: "bjk2021k-bun-jo-ka" }),
      }),
      koreanImage(new Request("http://localhost/memes/okk2020k-eok-kka/opengraph-image-k2cx9c"), {
        params: Promise.resolve({ key: "okk2020k-eok-kka" }),
      }),
      renderOgDefaultImage("ko"),
    ]);
    expect(missing.headers.get("cache-control")).toBe(ogImageCacheControl());
    expect(bun.headers.get("cache-control")).toBe(SHARE_CARD_FALLBACK_CACHE_CONTROL);
    const missingSha = sha256(await pngBytes(missing));
    const bunSha = sha256(await pngBytes(bun));
    const eokSha = sha256(await pngBytes(eok));
    expect(missingSha).toBe(sha256(await pngBytes(fallback)));
    expect(bunSha).not.toBe(missingSha);
    expect(eokSha).not.toBe(missingSha);
    expect(bunSha).not.toBe(eokSha);
    expect((await loadKoreanShareCard("bjk2021k-bun-jo-ka"))?.title).toContain("분좋카");
    expect((await loadKoreanShareCard("okk2020k-eok-kka"))?.title).toContain("억까");
    expect(await loadKoreanShareCard("not-a-real-meme")).toBeNull();
    expect((await loadKoreanShareCard("bjk2021k-bun-jo-ka"))?.title).not.toBe("밈캐치");
  });

  it("serves the locale default card when there is no translation", async () => {
    for (const locale of ["en", "ja", "ar", "ko", "fr"]) {
      const response = await localeImage(
        new Request(`http://localhost/${locale}/memes/not-a-real-meme/opengraph-image`),
        { params: Promise.resolve({ locale, key: "not-a-real-meme" }) },
      );
      const expected = await renderOgDefaultImage(locale === "fr" ? "en" : locale);
      if (locale === "ko" || locale === "ar") {
        expect(response.headers.get("cache-control")).toBe(ogImageCacheControl());
      }
      expect(sha256(await pngBytes(response))).toBe(sha256(await pngBytes(expected)));
    }
  });

  it("finds a curated meme by the slug tail, including later hyphens", async () => {
    expect(shareKeyParts("zzzzzzzz-bun-jo-ka").slug).toBe("bun-jo-ka");
    expect(shareKeyParts("zzzzzzzz-bun-jo-ka").slug).not.toBe("bun");
    const response = await koreanImage(
      new Request("http://localhost/memes/zzzzzzzz-bun-jo-ka/opengraph-image-k2cx9c"),
      { params: Promise.resolve({ key: "zzzzzzzz-bun-jo-ka" }) },
    );
    const fallback = await renderOgDefaultImage("ko");
    expect(sha256(await pngBytes(response))).not.toBe(sha256(await pngBytes(fallback)));
    expect((await loadKoreanShareCard("zzzzzzzz-bun-jo-ka"))?.title).toContain("분좋카");
    const keyCard = await renderMemeShareCard({
      locale: "ko",
      title: "bjk2021k-bun-jo-ka",
      summary: null,
      year: null,
      category: null,
    });
    const titled = await koreanImage(
      new Request("http://localhost/memes/bjk2021k-bun-jo-ka/opengraph-image-k2cx9c"),
      { params: Promise.resolve({ key: "bjk2021k-bun-jo-ka" }) },
    );
    expect(sha256(await pngBytes(titled))).not.toBe(sha256(await pngBytes(keyCard)));
    expect((await loadKoreanShareCard("bjk2021k-bun-jo-ka"))?.title).not.toBe("bjk2021k-bun-jo-ka");
  });

  it("restores the ImageResponse cache-control header for /ar/memes/*/opengraph-image", async () => {
    const sample = new ImageResponse(
      createElement("div", { style: { display: "flex" } }, "x"),
      { width: 8, height: 8 },
    );
    const response = await localeImage(
      new Request("http://localhost/ar/memes/bjk2021k-bun-jo-ka/opengraph-image"),
      { params: Promise.resolve({ locale: "ar", key: "bjk2021k-bun-jo-ka" }) },
    );
    expect(response.headers.get("cache-control")).toBe(sample.headers.get("cache-control"));
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("cache-control")).toBe(ogImageCacheControl());
  });

  it("keeps the current header when the locale lookup finds no translation", async () => {
    const lookup = vi.spyOn(memeTranslations, "getLocalizedMemeByShortId").mockResolvedValue(null);
    try {
      const response = await localeImage(
        new Request("http://localhost/en/memes/not-a-real-meme/opengraph-image"),
        { params: Promise.resolve({ locale: "en", key: "not-a-real-meme" }) },
      );
      expect(response.headers.get("cache-control")).toBe(ogImageCacheControl());
      const expected = await renderOgDefaultImage("en");
      expect(sha256(await pngBytes(response))).toBe(sha256(await pngBytes(expected)));
    } finally {
      lookup.mockRestore();
    }
  });

  it("uses the short header when the catalog lookup throws", async () => {
    const korean = vi.spyOn(shareContent, "loadKoreanShareCard").mockRejectedValue(new Error("catalog"));
    const locale = vi.spyOn(memeTranslations, "getLocalizedMemeByShortId").mockRejectedValue(new Error("catalog"));
    try {
      const koreanResponse = await koreanImage(
        new Request("http://localhost/memes/bjk2021k-bun-jo-ka/opengraph-image-k2cx9c"),
        { params: Promise.resolve({ key: "bjk2021k-bun-jo-ka" }) },
      );
      const localeResponse = await localeImage(
        new Request("http://localhost/en/memes/bjk2021k-bun-jo-ka/opengraph-image"),
        { params: Promise.resolve({ locale: "en", key: "bjk2021k-bun-jo-ka" }) },
      );
      expect(koreanResponse.headers.get("cache-control")).toBe(SHARE_CARD_FALLBACK_CACHE_CONTROL);
      expect(localeResponse.headers.get("cache-control")).toBe(SHARE_CARD_FALLBACK_CACHE_CONTROL);
    } finally {
      korean.mockRestore();
      locale.mockRestore();
    }
  });
});
