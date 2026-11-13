import { mkdirSync, writeFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { renderOgDefaultImage } from "@/lib/og-default-card";
import {
  OG_DEFAULT_COPY,
  OG_DEFAULT_DESIGN,
  OG_DEFAULT_LOCALES,
  estimateOgTextWidth,
  ogContentBox,
  ogDefaultCopy,
  ogDefaultLocaleHasHangul,
  ogLogoLineWidth,
  ogPageContentLocale,
  ogTitleFontSize,
  resolveOgDefaultLocale,
} from "@/lib/og-default-image";

const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;

function paeth(left: number, up: number, upLeft: number) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);
  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) return left;
  if (upDistance <= upLeftDistance) return up;
  return upLeft;
}

function decodePng(buffer: Buffer) {
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9] ?? 0;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  expect(colorType).toBe(6);
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rows: Buffer[] = [];
  let cursor = 0;
  const previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor] ?? 0;
    cursor += 1;
    const row = Buffer.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= 4 ? (row[index - 4] ?? 0) : 0;
      const up = previous[index] ?? 0;
      const upLeft = index >= 4 ? (previous[index - 4] ?? 0) : 0;
      const value = row[index] ?? 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          row[index] = (value + left) & 255;
          break;
        case 2:
          row[index] = (value + up) & 255;
          break;
        case 3:
          row[index] = (value + Math.floor((left + up) / 2)) & 255;
          break;
        case 4:
          row[index] = (value + paeth(left, up, upLeft)) & 255;
          break;
        default: {
          const unreachable: never = filter as never;
          throw new Error(`unsupported png filter ${unreachable}`);
        }
      }
    }
    previous.set(row);
    rows.push(Buffer.from(row));
  }
  return { width, height, rows };
}

function pixel(rows: Buffer[], x: number, y: number) {
  const row = rows[y];
  if (!row) throw new Error("missing row");
  const index = x * 4;
  return [row[index], row[index + 1], row[index + 2], row[index + 3]] as const;
}

describe("default preview copy", () => {
  it("covers exactly the six share locales and falls unknown locales back to English", () => {
    expect(OG_DEFAULT_LOCALES).toEqual(["ko", "en", "ja", "zh", "zh-tw", "ar"]);
    expect(resolveOgDefaultLocale("th")).toBe("en");
    expect(resolveOgDefaultLocale(undefined)).toBe("en");
    expect(ogDefaultCopy("th")).toEqual(OG_DEFAULT_COPY.en);
    expect(ogPageContentLocale("ar")).toBe("en");
    expect(ogPageContentLocale("ja")).toBe("ja");
  });

  it("keeps one Hangul-free title line inside the safe content box", () => {
    const box = ogContentBox();
    expect(OG_DEFAULT_DESIGN.minMarginPx).toBeGreaterThanOrEqual(60);
    expect(box.margin).toBeGreaterThanOrEqual(OG_DEFAULT_DESIGN.minMarginPx);
    expect(ogLogoLineWidth()).toBeLessThanOrEqual(box.width);

    for (const locale of OG_DEFAULT_LOCALES) {
      const copy = OG_DEFAULT_COPY[locale];
      expect(copy.title).toBe(copy.alt);
      expect(copy.title).not.toContain("\n");
      expect(ogDefaultLocaleHasHangul(locale)).toBe(locale === "ko");
      if (locale !== "ko") {
        expect(copy.title).not.toMatch(HANGUL);
        expect(copy.alt).not.toMatch(HANGUL);
      }
      const size = ogTitleFontSize(copy.title);
      expect(estimateOgTextWidth(copy.title, size)).toBeLessThanOrEqual(box.width);
    }
  });
});

describe("default preview image response", () => {
  it.each(OG_DEFAULT_LOCALES)(
    "returns a 1200x630 PNG under 5MB for %s with a clear margin",
    async (locale) => {
      const response = await renderOgDefaultImage(locale);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(OG_DEFAULT_DESIGN.contentType);
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.byteLength).toBeLessThan(OG_DEFAULT_DESIGN.maxBytes);
      const image = decodePng(bytes);
      expect(image.width).toBe(OG_DEFAULT_DESIGN.width);
      expect(image.height).toBe(OG_DEFAULT_DESIGN.height);

      mkdirSync("/tmp/og-preview", { recursive: true });
      writeFileSync(`/tmp/og-preview/${locale}.png`, bytes);

      const [red, green, blue] = pixel(image.rows, 0, 0);
      const margin = OG_DEFAULT_DESIGN.minMarginPx;
      let minX = image.width;
      let minY = image.height;
      let maxX = -1;
      let maxY = -1;
      let marginSpill: string | null = null;
      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          const [pr, pg, pb, pa] = pixel(image.rows, x, y);
          const ink = pr !== red || pg !== green || pb !== blue || pa !== 255;
          const inMargin = x < margin || y < margin || x >= image.width - margin || y >= image.height - margin;
          if (inMargin && ink && !marginSpill) marginSpill = `${x},${y}`;
          if (!ink) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      expect(marginSpill).toBeNull();
      expect(maxX).toBeGreaterThan(minX);
      const titleSize = ogTitleFontSize(OG_DEFAULT_COPY[locale].title);
      // One line plus logo. Extra slack covers Arabic vertical metrics, not a wrap.
      const oneLineHeight = 56 + 28 + Math.ceil(titleSize * 1.25) + 24;
      expect(maxY - minY).toBeLessThanOrEqual(oneLineHeight);
    },
    20_000,
  );
});
