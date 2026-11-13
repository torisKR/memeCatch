import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET, generateStaticParams } from "@/app/og/[locale]/route";
import { OG_DEFAULT_LOCALES } from "@/lib/og-default-image";

const ARABIC_FONT_SHA256 = "252e28731deedbb2df89e0960b974dba8e42138875d84806b6220f4a124c0dd5";
const ARABIC_FONT_VERSION = "2.012";

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

    const japanese = await GET(new Request("https://catchmeme.com/og/ja"), {
      params: Promise.resolve({ locale: "ja" }),
    });
    const simplified = await GET(new Request("https://catchmeme.com/og/zh"), {
      params: Promise.resolve({ locale: "zh" }),
    });
    const traditional = await GET(new Request("https://catchmeme.com/og/zh-tw"), {
      params: Promise.resolve({ locale: "zh-tw" }),
    });
    const japaneseBytes = Buffer.from(await japanese.arrayBuffer());
    const simplifiedBytes = Buffer.from(await simplified.arrayBuffer());
    const traditionalBytes = Buffer.from(await traditional.arrayBuffer());
    expect(japaneseBytes.equals(simplifiedBytes)).toBe(false);
    expect(simplifiedBytes.equals(traditionalBytes)).toBe(false);

    for (const locale of ["th", "EN", "en-US", ""]) {
      const response = await GET(new Request(`https://catchmeme.com/og/${locale}`), {
        params: Promise.resolve({ locale }),
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toContain("text/plain");
      expect(await response.text()).toBe("Not found");
    }
  }, 40_000);

  it("serves the committed Arabic card and records the font version", async () => {
    const response = await GET(new Request("https://catchmeme.com/og/ar"), {
      params: Promise.resolve({ locale: "ar" }),
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const file = readFileSync("assets/og/ar.png");
    const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
    expect(hash(bytes)).toBe(hash(file));
    const font = readFileSync("assets/og-fonts/ar.ttf");
    expect(hash(font)).toBe(ARABIC_FONT_SHA256);
    const version = Buffer.from(`Version ${ARABIC_FONT_VERSION}`, "utf16le");
    for (let index = 0; index < version.length; index += 2) {
      const first = version[index] ?? 0;
      version[index] = version[index + 1] ?? 0;
      version[index + 1] = first;
    }
    expect(font.includes(version)).toBe(true);
  });
});
