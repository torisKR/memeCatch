import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, inflateSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { contrastRatio } from "@/lib/a11y-contrast";
import { renderMemeShareCard, respondWithShareCard, shareFontMetrics } from "@/lib/meme-share-card";
import { cardFromLocalized } from "@/lib/meme-share-content";
import {
  MEME_SHARE_DESIGN,
  type MemeShareCardContent,
} from "@/lib/meme-share-image";
import { fitShareLines, layoutMemeShareCard, measureText, type ShareFontSet } from "@/lib/meme-share-layout";
import { renderOgDefaultImage } from "@/lib/og-default-card";

const MAIN = "e5841d8ce7fc8aed6e3f1cfd3188dee9c79606dd";

function sha256(body: Buffer) {
  return createHash("sha256").update(body).digest("hex");
}

function decodePng(png: Buffer) {
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (pos + 8 <= png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString("latin1", pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = Buffer.alloc(width * height * 4);
  let offset = 0;
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset] ?? 0;
    offset += 1;
    const row = Buffer.from(raw.subarray(offset, offset + stride));
    offset += stride;
    if (filter === 1) {
      for (let index = 0; index < stride; index += 1) {
        row[index] = (row[index]! + (index >= 4 ? row[index - 4]! : 0)) & 255;
      }
    } else if (filter === 2) {
      for (let index = 0; index < stride; index += 1) row[index] = (row[index]! + previous[index]!) & 255;
    } else if (filter === 3) {
      for (let index = 0; index < stride; index += 1) {
        const left = index >= 4 ? row[index - 4]! : 0;
        row[index] = (row[index]! + Math.floor((left + previous[index]!) / 2)) & 255;
      }
    } else if (filter === 4) {
      for (let index = 0; index < stride; index += 1) {
        const left = index >= 4 ? row[index - 4]! : 0;
        const up = previous[index]!;
        const upLeft = index >= 4 ? previous[index - 4]! : 0;
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        const predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        row[index] = (row[index]! + predicted) & 255;
      }
    } else if (filter !== 0) {
      throw new Error(`unsupported png filter ${filter}`);
    }
    row.copy(rgba, y * stride);
    previous = row;
  }
  return { width, height, rgba };
}

function crc32(data: Buffer) {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function encodePng(width: number, height: number, rgba: Buffer) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function cropCenter(png: Buffer) {
  const { width, height, rgba } = decodePng(png);
  const side = MEME_SHARE_DESIGN.centerSquare;
  const left = Math.round((width - side) / 2);
  const out = Buffer.alloc(side * height * 4);
  for (let y = 0; y < height; y += 1) {
    rgba.copy(out, y * side * 4, (y * width + left) * 4, (y * width + left + side) * 4);
  }
  return encodePng(side, height, out);
}

function inkX(png: Buffer) {
  const { width, height, rgba } = decodePng(png);
  let minX = width;
  let maxX = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const away = Math.abs(rgba[index]! - 0x13) > 12
        || Math.abs(rgba[index + 1]! - 0x13) > 12
        || Math.abs(rgba[index + 2]! - 0x16) > 12;
      if ((rgba[index + 3] ?? 0) > 20 && away) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  return { minX, maxX };
}

async function paint(card: MemeShareCardContent) {
  const response = await renderMemeShareCard(card);
  expect(response.status).toBe(200);
  const body = Buffer.from(await response.arrayBuffer());
  const size = decodePng(body);
  expect(size.width).toBe(1200);
  expect(size.height).toBe(630);
  return body;
}

const ARTIFACTS = "/opt/cursor/artifacts";

function savePair(name: string, png: Buffer) {
  if (!existsSync(ARTIFACTS)) return;
  mkdirSync(ARTIFACTS, { recursive: true });
  writeFileSync(`${ARTIFACTS}/${name}.png`, png);
  writeFileSync(`${ARTIFACTS}/${name}-center.png`, cropCenter(png));
}

describe("per-meme share card", () => {
  it("keeps untranslated, Arabic, and non-detail pages identical to main", () => {
    expect(existsSync("app/ar")).toBe(false);
    const source = readFileSync("app/[locale]/memes/[key]/page.tsx", "utf8");
    const main = execFileSync("git", ["show", `${MAIN}:app/[locale]/memes/[key]/page.tsx`], {
      encoding: "utf8",
    });
    const marker = "export default async function LocalizedMemePage";
    expect(source.slice(source.indexOf(marker))).toBe(main.slice(main.indexOf(marker)));
    expect(source).toContain("if (!meme) notFound();");
    expect(source.match(/if \(shareLocale === "ar"\) notFound\(\);/g)).toHaveLength(2);
    expect(source).not.toContain("koreanMemeShareImage");
    execFileSync("git", [
      "diff",
      "--exit-code",
      MAIN,
      "--",
      "app/(default)/community/[id]/page.tsx",
      "app/[locale]/not-found.tsx",
      "app/(default)/not-found.tsx",
      "app/(default)/quiz/page.tsx",
      "app/(default)/weekly/page.tsx",
      "app/(default)/collections/page.tsx",
    ]);
  });

  it("omits a missing summary and never copies one from another language", () => {
    const card = cardFromLocalized("en", {
      title: "Fighting",
      summary: "   ",
      origin_year: 2021,
      category: "phrase",
    });
    expect(card?.summary).toBeNull();
    expect(JSON.stringify(card)).not.toContain("한국어");
  });

  it("fits the title and summary by measured width without shrinking the font", async () => {
    const fonts: ShareFontSet = await shareFontMetrics();
    const narrow = "i".repeat(21);
    expect(measureText(narrow, MEME_SHARE_DESIGN.titleFontSize, "en", fonts)).toBeLessThanOrEqual(540);
    expect(fitShareLines(narrow, MEME_SHARE_DESIGN.titleFontSize, 2, "en", fonts)).toEqual([narrow]);

    const longTitle = "가".repeat(40);
    const long = layoutMemeShareCard({
      locale: "ko",
      title: longTitle,
      summary: "의미 ".repeat(30),
      year: 2021,
      category: "phrase",
    }, fonts);
    const short = layoutMemeShareCard({
      locale: "ko",
      title: "가",
      summary: "뜻",
      year: null,
      category: null,
    }, fonts);
    expect(long.titleFontSize).toBe(short.titleFontSize);
    expect(long.titleFontSize).toBeGreaterThanOrEqual(56);
    expect(long.summaryFontSize).toBeGreaterThanOrEqual(32);
    expect(long.titleLines.length).toBeLessThanOrEqual(2);
    expect(long.titleLines.at(-1)).toMatch(/…$/);
    expect(long.titleLines[0]).not.toMatch(/…$/);
    expect(long.summaryLine).toMatch(/…$/);
    expect(long.summaryLine).not.toContain("\n");
    for (const line of [...long.titleLines, long.summaryLine ?? ""]) {
      expect(measureText(line, line === long.summaryLine ? long.summaryFontSize : long.titleFontSize, "ko", fonts))
        .toBeLessThanOrEqual(540);
    }
    const words = fitShareLines("Distractingly wonderful title", 56, 2, "en", fonts);
    expect(words.join(" ")).not.toMatch(/Distract…/);
    expect(words.every((line) => !line.endsWith("…") || line === words.at(-1))).toBe(true);

    const bun = layoutMemeShareCard({
      locale: "ko",
      title: "분좋카 (분위기 좋은 카페)",
      summary: "감각적인 인테리어, 채광, 음악이 어우러져 사진 찍기 좋고 머물기 좋은 카페를 줄여 부르는 말.",
      year: 2021,
      category: "phrase",
    }, fonts);
    expect(bun.chip).toBe("2021 · 유행어");
    expect(bun.wordmarkFontSize).toBeLessThan(bun.titleFontSize);
    expect(bun.logoSize).toBeLessThan(bun.titleFontSize);
    const empty = layoutMemeShareCard({
      locale: "ko",
      title: "빈 뜻",
      summary: null,
      year: null,
      category: null,
    }, fonts);
    expect(empty.summaryLine).toBeNull();
    expect(empty.chip).toBeNull();
  });

  it("falls back to the locale card when rendering throws", async () => {
    const failed = await respondWithShareCard("ja", {
      locale: "ja",
      title: "タイトル",
      summary: "意味",
      year: null,
      category: null,
    }, async () => {
      throw new Error("render failed");
    });
    const expected = await renderOgDefaultImage("ja");
    expect(sha256(Buffer.from(await failed.arrayBuffer()))).toBe(
      sha256(Buffer.from(await expected.arrayBuffer())),
    );
  });

  it("centers every sample inside x 330–870 and writes a 630 crop", async () => {
    const samples: { name: string; card: MemeShareCardContent }[] = [
      {
        name: "ko-long-title",
        card: {
          locale: "ko",
          title: "가".repeat(40),
          summary: "아주 긴 뜻 설명입니다 ".repeat(8),
          year: 2024,
          category: "phrase",
        },
      },
      {
        name: "ko-mixed-english",
        card: {
          locale: "ko",
          title: "Good vibe 분좋카",
          summary: "A nice cafe, 분위기 좋은 카페.",
          year: 2021,
          category: "phrase",
        },
      },
      {
        name: "ko-emoji",
        card: {
          locale: "ko",
          title: "파이팅 🔥",
          summary: "힘내라는 한 마디",
          year: null,
          category: "phrase",
        },
      },
      {
        name: "ko-empty-summary",
        card: {
          locale: "ko",
          title: "빈 뜻",
          summary: null,
          year: 2020,
          category: "dance",
        },
      },
      {
        name: "ko-bun-jo-ka",
        card: {
          locale: "ko",
          title: "분좋카 (분위기 좋은 카페)",
          summary: "감각적인 인테리어, 채광, 음악이 어우러져 사진 찍기 좋고 머물기 좋은 카페를 줄여 부르는 말.",
          year: 2021,
          category: "phrase",
        },
      },
      {
        name: "ko-eok-kka",
        card: {
          locale: "ko",
          title: "억까 (억지 까기)",
          summary: "정당한 이유 없이 억지로 트집을 잡아 비난할 때 쓰는 말.",
          year: 2020,
          category: "phrase",
        },
      },
      {
        name: "en-fighting",
        card: {
          locale: "en",
          title: "Fighting",
          summary: "A cheer that means keep going.",
          year: 2020,
          category: "phrase",
        },
      },
      {
        name: "ja-fighting",
        card: {
          locale: "ja",
          title: "ファイティング",
          summary: "頑張れ、という応援の言葉。",
          year: 2020,
          category: "phrase",
        },
      },
      {
        name: "zh-fighting",
        card: {
          locale: "zh",
          title: "加油",
          summary: "表示鼓励对方继续努力的一句韩语。",
          year: 2020,
          category: "phrase",
        },
      },
      {
        name: "zh-tw-fighting",
        card: {
          locale: "zh-tw",
          title: "加油",
          summary: "表示鼓勵對方繼續努力的一句韓語。",
          year: 2020,
          category: "phrase",
        },
      },
    ];
    const measured: { name: string; minX: number; maxX: number }[] = [];
    for (const sample of samples) {
      const png = await paint(sample.card);
      const bounds = inkX(png);
      expect(bounds.minX).toBeGreaterThanOrEqual(MEME_SHARE_DESIGN.contentLeft - 1);
      expect(bounds.maxX).toBeLessThanOrEqual(MEME_SHARE_DESIGN.contentRight + 1);
      savePair(sample.name, png);
      measured.push({ name: sample.name, ...bounds });
    }
    const titleContrast = contrastRatio(MEME_SHARE_DESIGN.foreground, MEME_SHARE_DESIGN.background);
    const summaryContrast = contrastRatio(MEME_SHARE_DESIGN.summary, MEME_SHARE_DESIGN.background);
    const chipContrast = contrastRatio(MEME_SHARE_DESIGN.foreground, MEME_SHARE_DESIGN.chipBackground);
    expect(titleContrast).toBeGreaterThanOrEqual(4.5);
    expect(summaryContrast).toBeGreaterThanOrEqual(4.5);
    expect(chipContrast).toBeGreaterThanOrEqual(4.5);
    if (existsSync(ARTIFACTS)) writeFileSync(`${ARTIFACTS}/design-compliance.json`, JSON.stringify({
      titleFontSize: MEME_SHARE_DESIGN.titleFontSize,
      summaryFontSize: MEME_SHARE_DESIGN.summaryFontSize,
      titleContrast: Number(titleContrast.toFixed(2)),
      summaryContrast: Number(summaryContrast.toFixed(2)),
      chipContrast: Number(chipContrast.toFixed(2)),
      contentLeft: MEME_SHARE_DESIGN.contentLeft,
      contentRight: MEME_SHARE_DESIGN.contentRight,
      samples: measured,
    }, null, 2));
  }, 30_000);
});
