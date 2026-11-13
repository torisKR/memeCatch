import { describe, expect, it } from "vitest";
import { GET, generateStaticParams } from "@/app/og/[locale]/route";
import { OG_DEFAULT_LOCALES } from "@/lib/og-default-image";

function pngSize(bytes: Buffer) {
  expect(bytes.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(bytes.toString("ascii", 12, 16)).toBe("IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("/og/[locale]", () => {
  it("prebuilds only the six share locales", () => {
    expect(generateStaticParams()).toEqual(OG_DEFAULT_LOCALES.map((locale) => ({ locale })));
  });

  it.each(OG_DEFAULT_LOCALES)(
    "returns a cached 1200x630 PNG for %s",
    async (locale) => {
      const response = await GET(new Request(`https://catchmeme.com/og/${locale}`), {
        params: Promise.resolve({ locale }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("image/png");
      expect(response.headers.get("cache-control")).toBe("public, max-age=86400");
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.byteLength).toBeGreaterThan(1000);
      expect(bytes.byteLength).toBeLessThan(5 * 1024 * 1024);
      expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 });
    },
    20_000,
  );

  it("does not serve the Korean card for another locale or an unknown locale", async () => {
    const korean = await GET(new Request("https://catchmeme.com/og/ko"), {
      params: Promise.resolve({ locale: "ko" }),
    });
    const english = await GET(new Request("https://catchmeme.com/og/en"), {
      params: Promise.resolve({ locale: "en" }),
    });
    const koreanBytes = Buffer.from(await korean.arrayBuffer());
    const englishBytes = Buffer.from(await english.arrayBuffer());
    expect(englishBytes.equals(koreanBytes)).toBe(false);

    for (const locale of ["th", "EN", "en-US", ""]) {
      const response = await GET(new Request(`https://catchmeme.com/og/${locale}`), {
        params: Promise.resolve({ locale }),
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(await response.text()).toBe("Not found");
    }
  });
});
