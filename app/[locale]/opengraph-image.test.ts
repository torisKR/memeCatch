import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generateImageMetadata } from "@/app/[locale]/opengraph-image";

describe("legacy locale opengraph image", () => {
  it("sends /ar/opengraph-image/* to the global not-found path", () => {
    const source = readFileSync("next.config.ts", "utf8");
    const rewrite = source.indexOf('source: "/ar/opengraph-image/:path*"');
    const rankings = source.indexOf('destination: "/locale-rankings/:locale"');
    expect(rewrite).toBeGreaterThan(-1);
    expect(source).toContain('destination: "/ar"');
    expect(rankings).toBeGreaterThan(rewrite);
  });

  it("still describes the English card for the English document", async () => {
    const images = await generateImageMetadata({ params: Promise.resolve({ locale: "en" }) });
    expect(images).toEqual([
      expect.objectContaining({
        id: "en",
        alt: "MemeCatch — Korean Memes Explained",
        contentType: "image/png",
      }),
    ]);
  });
});
