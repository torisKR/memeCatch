import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { renderOgDefaultImage } from "@/lib/og-default-card";
import {
  OG_DEFAULT_COPY,
  OG_DEFAULT_DESIGN,
  OG_DEFAULT_LOCALES,
  ogDefaultCopy,
  ogDefaultImageDescriptor,
  ogDefaultLocaleHasHangul,
  ogPageContentLocale,
  ogTitlePreviewPx,
  resolveOgDefaultLocale,
} from "@/lib/og-default-image";

const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;
const PUNCTUATION_LINE = /^[\s\p{P}\p{S}]+$/u;

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
  return [row[index] ?? 0, row[index + 1] ?? 0, row[index + 2] ?? 0, row[index + 3] ?? 0] as const;
}

/** Ink widths of the joined Arabic title, one cluster list per line. */
function arabicTitleClusters(
  image: { width: number; height: number; rows: Buffer[] },
  isBackground: (sample: readonly number[]) => boolean,
  chipMaxY: number,
) {
  const hits = Array.from({ length: image.height }, (_, y) => {
    if (y <= chipMaxY + 8) return false;
    let ink = 0;
    for (let x = 0; x < image.width; x += 1) {
      if (!isBackground(pixel(image.rows, x, y))) ink += 1;
    }
    return ink >= 30;
  });
  const bands: Array<[number, number]> = [];
  let start: number | null = null;
  let gap = 0;
  for (let y = 0; y < hits.length; y += 1) {
    if (hits[y]) {
      if (start === null) start = y;
      gap = 0;
    } else if (start !== null) {
      gap += 1;
      if (gap > 8) {
        bands.push([start, y - gap]);
        start = null;
      }
    }
  }
  return bands.map(([top, bottom]) => {
    const xs: number[] = [];
    for (let x = 0; x < image.width; x += 1) {
      for (let y = top; y <= bottom; y += 1) {
        if (!isBackground(pixel(image.rows, x, y))) {
          xs.push(x);
          break;
        }
      }
    }
    const clusters: number[] = [];
    if (xs.length === 0) return clusters;
    let clusterStart = xs[0] ?? 0;
    let previous = clusterStart;
    for (const x of xs.slice(1)) {
      if (x > previous + 14) {
        clusters.push(previous - clusterStart + 1);
        clusterStart = x;
      }
      previous = x;
    }
    clusters.push(previous - clusterStart + 1);
    return clusters;
  });
}

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (~crc) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  body.copy(chunk, 4);
  chunk.writeUInt32BE(crc32(body), 8 + data.length);
  return chunk;
}

function encodePng(width: number, height: number, rgba: Buffer) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const start = y * (stride + 1);
    raw[start] = 0;
    rgba.copy(raw, start + 1, y * stride, y * stride + stride);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function cropPng(image: { width: number; height: number; rows: Buffer[] }, frame: { x: number; y: number; width: number; height: number }) {
  const rgba = Buffer.alloc(frame.width * frame.height * 4);
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const [red, green, blue, alpha] = pixel(image.rows, frame.x + x, frame.y + y);
      const index = (y * frame.width + x) * 4;
      rgba[index] = red;
      rgba[index + 1] = green;
      rgba[index + 2] = blue;
      rgba[index + 3] = alpha;
    }
  }
  return encodePng(frame.width, frame.height, rgba);
}

function previewPng(image: { width: number; height: number; rows: Buffer[] }, targetWidth: number) {
  const targetHeight = Math.round((image.height * targetWidth) / image.width);
  const rgba = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / targetWidth));
      const [red, green, blue, alpha] = pixel(image.rows, sourceX, sourceY);
      const index = (y * targetWidth + x) * 4;
      rgba[index] = red;
      rgba[index + 1] = green;
      rgba[index + 2] = blue;
      rgba[index + 3] = alpha;
    }
  }
  return encodePng(targetWidth, targetHeight, rgba);
}

function channel(value: number) {
  const srgb = value / 255;
  return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((parsed >> 16) & 255) +
    0.7152 * channel((parsed >> 8) & 255) +
    0.0722 * channel(parsed & 255)
  );
}

function contrast(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function hexChannels(hex: string) {
  const parsed = Number.parseInt(hex.slice(1), 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255] as const;
}

function channelDistance(sample: readonly number[], hex: string) {
  const [red, green, blue] = hexChannels(hex);
  return Math.abs((sample[0] ?? 0) - red) + Math.abs((sample[1] ?? 0) - green) + Math.abs((sample[2] ?? 0) - blue);
}

describe("default preview copy", () => {
  it("covers exactly the six share locales and falls unknown locales back to English", () => {
    expect(OG_DEFAULT_LOCALES).toEqual(["ko", "en", "ja", "zh", "zh-tw", "ar"]);
    expect(resolveOgDefaultLocale("th")).toBe("en");
    expect(resolveOgDefaultLocale(undefined)).toBe("en");
    expect(ogDefaultCopy("th")).toEqual(OG_DEFAULT_COPY.en);
    expect(ogPageContentLocale("ar")).toBe("en");
    expect(ogPageContentLocale("ja")).toBe("ja");
    expect(ogDefaultImageDescriptor("ja").url).toBe("/og/ja");
  });

  it("keeps a readable title inside 540px, with phrase-safe breaks", () => {
    expect(OG_DEFAULT_DESIGN.minMarginPx).toBeGreaterThanOrEqual(60);
    expect(OG_DEFAULT_DESIGN.titleFontSize).toBeGreaterThanOrEqual(48);
    expect(OG_DEFAULT_DESIGN.titleMaxWidthPx).toBeLessThanOrEqual(540);
    expect(ogTitlePreviewPx(300)).toBeGreaterThanOrEqual(12);
    expect(contrast(OG_DEFAULT_DESIGN.icon, OG_DEFAULT_DESIGN.accent)).toBeGreaterThanOrEqual(3);
    expect(contrast(OG_DEFAULT_DESIGN.foreground, OG_DEFAULT_DESIGN.background)).toBeGreaterThanOrEqual(15);

    expect(OG_DEFAULT_COPY.ko.lines.join(" ")).toBe(OG_DEFAULT_COPY.ko.title);
    expect(OG_DEFAULT_COPY.en.lines.join(" ")).toBe("Korean Memes Explained");
    expect(OG_DEFAULT_COPY.ja.lines.join("")).toBe("韓国ミームをわかりやすく解説");
    expect(OG_DEFAULT_COPY.zh.lines).toEqual(["看懂韩国网络迷因"]);
    expect(OG_DEFAULT_COPY["zh-tw"].lines).toEqual(["看懂韓國網路迷因"]);
    expect(OG_DEFAULT_COPY.ar.lines.flatMap((line) => line.split(/\s+/))).toEqual("شرح الميمات الكورية".split(" "));

    for (const locale of OG_DEFAULT_LOCALES) {
      const copy = OG_DEFAULT_COPY[locale];
      expect(copy.title).toBe(copy.alt);
      expect(copy.lines.length).toBeGreaterThan(0);
      expect(copy.lines.length).toBeLessThanOrEqual(2);
      expect(ogDefaultLocaleHasHangul(locale)).toBe(locale === "ko");
      for (const line of copy.lines) {
        expect(line).not.toMatch(PUNCTUATION_LINE);
        if (locale !== "ko") expect(line).not.toMatch(HANGUL);
      }
      if (locale !== "ko") {
        expect(copy.title).not.toMatch(HANGUL);
        expect(copy.alt).not.toMatch(HANGUL);
      }
    }
  });
});

describe("default preview image response", () => {
  it.each(OG_DEFAULT_LOCALES)(
    "keeps the logo and title inside the square, 2:1, and 1.91:1 crops for %s",
    async (locale) => {
      const response = await renderOgDefaultImage(locale);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(OG_DEFAULT_DESIGN.contentType);
      const bytes = Buffer.from(await response.arrayBuffer());
      expect(bytes.byteLength).toBeLessThan(OG_DEFAULT_DESIGN.maxBytes);
      const image = decodePng(bytes);
      expect(image.width).toBe(OG_DEFAULT_DESIGN.width);
      expect(image.height).toBe(OG_DEFAULT_DESIGN.height);

      const [backgroundRed, backgroundGreen, backgroundBlue] = pixel(image.rows, 0, 0);
      const isBackground = (sample: readonly number[]) =>
        sample[0] === backgroundRed && sample[1] === backgroundGreen && sample[2] === backgroundBlue && sample[3] === 255;
      const margin = OG_DEFAULT_DESIGN.minMarginPx;
      const squareX = (image.width - OG_DEFAULT_DESIGN.centerSquarePx) / 2;
      const twoToOneY = (image.height - image.width / 2) / 2;
      const kakao = { x: (image.width - 800) / 2, y: (image.height - 400) / 2, width: 800, height: 400 };
      const frames = {
        margin: { x: margin, y: margin, width: image.width - margin * 2, height: image.height - margin * 2 },
        square: { x: squareX, y: 0, width: OG_DEFAULT_DESIGN.centerSquarePx, height: image.height },
        twoToOne: { x: 0, y: twoToOneY, width: image.width, height: image.width / 2 },
        kakao,
      };

      let minX = image.width;
      let minY = image.height;
      let maxX = -1;
      let maxY = -1;
      let chipMinX = image.width;
      let chipMinY = image.height;
      let chipMaxX = -1;
      let chipMaxY = -1;
      const chipCounts = new Map<string, number>();
      const iconCounts = new Map<string, number>();

      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          const sample = pixel(image.rows, x, y);
          if (isBackground(sample)) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (channelDistance(sample, OG_DEFAULT_DESIGN.accent) <= 36) {
            if (x < chipMinX) chipMinX = x;
            if (y < chipMinY) chipMinY = y;
            if (x > chipMaxX) chipMaxX = x;
            if (y > chipMaxY) chipMaxY = y;
            const key = `${sample[0]},${sample[1]},${sample[2]}`;
            chipCounts.set(key, (chipCounts.get(key) ?? 0) + 1);
          }
        }
      }

      mkdirSync("/tmp/og-preview", { recursive: true });
      writeFileSync(`/tmp/og-preview/${locale}.png`, bytes);

      expect(maxX).toBeGreaterThan(minX);
      expect(chipMaxX).toBeGreaterThan(chipMinX);
      for (const [name, frame] of Object.entries(frames)) {
        expect(minX, name).toBeGreaterThanOrEqual(frame.x);
        expect(minY, name).toBeGreaterThanOrEqual(frame.y);
        expect(maxX, name).toBeLessThan(frame.x + frame.width);
        expect(maxY, name).toBeLessThan(frame.y + frame.height);
      }
      const center = (minX + maxX) / 2;
      expect(Math.abs(center - (image.width - 1) / 2)).toBeLessThanOrEqual(8);

      let wordmarkInk = 0;
      for (let y = chipMinY; y <= chipMaxY; y += 1) {
        for (let x = chipMaxX + 24; x <= chipMaxX + 180; x += 1) {
          if (!isBackground(pixel(image.rows, x, y))) wordmarkInk += 1;
        }
      }
      expect(wordmarkInk).toBeGreaterThan(400);

      let titleMinX = image.width;
      let titleMaxX = -1;
      const titleRows: boolean[] = [];
      for (let y = chipMaxY + 8; y < image.height; y += 1) {
        let ink = 0;
        let rowMin = image.width;
        let rowMax = -1;
        for (let x = 0; x < image.width; x += 1) {
          const sample = pixel(image.rows, x, y);
          if (isBackground(sample)) continue;
          ink += 1;
          if (x < rowMin) rowMin = x;
          if (x > rowMax) rowMax = x;
        }
        const hit = ink >= 30;
        if (hit) {
          if (rowMin < titleMinX) titleMinX = rowMin;
          if (rowMax > titleMaxX) titleMaxX = rowMax;
        }
        titleRows.push(hit);
      }
      const titleWidth = titleMaxX - titleMinX + 1;
      expect(titleWidth).toBeLessThanOrEqual(OG_DEFAULT_DESIGN.titleMaxWidthPx);
      expect(titleWidth).toBeGreaterThan(120);

      const bands: number[] = [];
      let run = 0;
      let gap = 0;
      for (const hit of titleRows) {
        if (hit) {
          if (run === 0 && gap > 0 && bands.length > 0 && gap <= 8) {
            run = (bands.pop() ?? 0) + gap;
          }
          gap = 0;
          run += 1;
        } else if (run > 0) {
          bands.push(run);
          run = 0;
          gap = 1;
        } else if (bands.length > 0) {
          gap += 1;
        }
      }
      if (run > 0) bands.push(run);
      expect(bands, bands.join(",")).toHaveLength(OG_DEFAULT_COPY[locale].lines.length);
      if (locale === "ar") {
        const clusters = arabicTitleClusters(image, isBackground, chipMaxY);
        const [memes, explanation] = clusters[0] ?? [];
        const [korean] = clusters[1] ?? [];
        expect(Math.abs((memes ?? 0) - 224) / 224).toBeLessThanOrEqual(0.05);
        expect(Math.abs((explanation ?? 0) - 132) / 132).toBeLessThanOrEqual(0.05);
        expect(Math.abs((korean ?? 0) - 180) / 180).toBeLessThanOrEqual(0.05);
      }
      for (const band of bands) {
        expect(band, bands.join(",")).toBeGreaterThanOrEqual(locale === "en" || locale === "ar" ? 30 : 40);
        expect((band * 300) / image.width).toBeGreaterThanOrEqual(10);
      }

      for (let y = chipMinY; y <= chipMaxY; y += 1) {
        for (let x = chipMinX; x <= chipMaxX; x += 1) {
          const sample = pixel(image.rows, x, y);
          if (channelDistance(sample, OG_DEFAULT_DESIGN.icon) > 30) continue;
          const key = `${sample[0]},${sample[1]},${sample[2]}`;
          iconCounts.set(key, (iconCounts.get(key) ?? 0) + 1);
        }
      }
      const mode = (counts: Map<string, number>) =>
        [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
      const chip = mode(chipCounts);
      const icon = mode(iconCounts);
      expect(chip).toBeTruthy();
      expect(icon).toBeTruthy();
      const [chipRed, chipGreen, chipBlue] = (chip ?? "0,0,0").split(",").map(Number);
      const [iconRed, iconGreen, iconBlue] = (icon ?? "0,0,0").split(",").map(Number);
      const chipHex = `#${[chipRed, chipGreen, chipBlue].map((value) => (value ?? 0).toString(16).padStart(2, "0")).join("")}`;
      const iconHex = `#${[iconRed, iconGreen, iconBlue].map((value) => (value ?? 0).toString(16).padStart(2, "0")).join("")}`;
      expect(contrast(iconHex, chipHex), `${iconHex} on ${chipHex}`).toBeGreaterThanOrEqual(3);

      writeFileSync(`/tmp/og-preview/${locale}-square.png`, cropPng(image, frames.square));
      writeFileSync(`/tmp/og-preview/${locale}-2x1.png`, cropPng(image, {
        x: 0,
        y: twoToOneY,
        width: image.width,
        height: image.width / 2,
      }));
      const previewBytes = previewPng(image, 300);
      const preview = decodePng(previewBytes);
      expect(preview.width).toBe(300);
      expect(ogTitlePreviewPx(preview.width)).toBeGreaterThanOrEqual(12);
      writeFileSync(`/tmp/og-preview/${locale}-300.png`, previewBytes);
    },
    20_000,
  );
});
