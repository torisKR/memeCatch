import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { GET as koreanImage } from "@/app/(default)/memes/[key]/opengraph-image-k2cx9c/route";
import { GET as localeImage } from "@/app/[locale]/memes/[key]/opengraph-image/route";

const KOREAN_FALLBACK_SHA256 =
  "968643504db6cc0ea42091c812cba44f89bced3569ad88c6ade2260774b694f2";
const NON_SEO_LOCALE_FALLBACK_SHA256 =
  "dff39b55a17d9ce4eb74837e6aeebfea9b6bf2a3ec01b00a93958fe20d2284df";

async function pngSha256(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("image/png");
  const body = Buffer.from(await response.arrayBuffer());
  return createHash("sha256").update(body).digest("hex");
}

describe("legacy per-meme image routes", () => {
  it("returns main's Korean fallback PNG when the catalog is unset", async () => {
    const response = await koreanImage(new Request("http://localhost/memes/not-a-real-meme/opengraph-image-k2cx9c"), {
      params: Promise.resolve({ key: "not-a-real-meme" }),
    });
    expect(await pngSha256(response)).toBe(KOREAN_FALLBACK_SHA256);
  });

  it("paints the curated meme instead of the generic fallback when the catalog row is missing", async () => {
    const response = await koreanImage(new Request("http://localhost/memes/bjk2021k-bun-jo-ka/opengraph-image-k2cx9c"), {
      params: Promise.resolve({ key: "bjk2021k-bun-jo-ka" }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");
    const body = Buffer.from(await response.arrayBuffer());
    const hash = createHash("sha256").update(body).digest("hex");
    expect(hash).not.toBe(KOREAN_FALLBACK_SHA256);
    mkdirSync("/opt/cursor/artifacts", { recursive: true });
    writeFileSync("/opt/cursor/artifacts/ko-curated-bun-jo-ka.png", body);
  });

  it("returns main's English fallback PNG for Arabic and other non-SEO prefixes", async () => {
    for (const locale of ["ar", "ko", "fr"]) {
      const response = await localeImage(new Request(`http://localhost/${locale}/memes/not-a-real-meme/opengraph-image`), {
        params: Promise.resolve({ locale, key: "not-a-real-meme" }),
      });
      expect(await pngSha256(response)).toBe(NON_SEO_LOCALE_FALLBACK_SHA256);
    }
  });

  it("raises the same catalog error as main for an SEO locale when the database is unset", async () => {
    await expect(
      localeImage(new Request("http://localhost/en/memes/not-a-real-meme/opengraph-image"), {
        params: Promise.resolve({ locale: "en", key: "not-a-real-meme" }),
      }),
    ).rejects.toMatchObject({ code: "meme_catalog_unavailable" });
  });
});
