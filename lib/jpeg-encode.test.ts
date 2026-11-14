import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { encodeJpeg, fitShareCardBytes, SHARE_CARD_BYTE_LIMIT } from "@/lib/jpeg-encode";
import { encodePng } from "@/lib/png-raster";

function decodeJpeg(jpeg: Buffer): { width: number; height: number; rgb: Buffer } {
  const info = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", "pipe:0"],
    { input: jpeg, encoding: "utf8" },
  ).trim();
  const [width, height] = info.split(",").map((part) => Number(part));
  const rgb = execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"],
    { input: jpeg, maxBuffer: 20_000_000 },
  );
  return { width: width ?? 0, height: height ?? 0, rgb };
}

describe("share card jpeg", () => {
  it("encodes a solid color that ffmpeg can read", () => {
    const width = 32;
    const height = 32;
    const rgba = Buffer.alloc(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      rgba[index * 4] = 220;
      rgba[index * 4 + 1] = 30;
      rgba[index * 4 + 2] = 40;
      rgba[index * 4 + 3] = 255;
    }
    const jpeg = encodeJpeg({ width, height, rgba }, 80);
    expect(jpeg.subarray(0, 2).toString("hex")).toBe("ffd8");
    const decoded = decodeJpeg(jpeg);
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(decoded.rgb[0]).toBeGreaterThan(180);
    expect(decoded.rgb[1]).toBeLessThan(80);
    expect(decoded.rgb[2]).toBeLessThan(90);
  });

  it("shrinks a noisy card under 1MB", () => {
    const width = 1200;
    const height = 630;
    const rgba = Buffer.alloc(width * height * 4);
    let state = 0x12345678;
    for (let index = 0; index < width * height; index += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      rgba[index * 4] = state & 255;
      rgba[index * 4 + 1] = (state >>> 8) & 255;
      rgba[index * 4 + 2] = (state >>> 16) & 255;
      rgba[index * 4 + 3] = 255;
    }
    const png = encodePng(width, height, rgba);
    expect(png.length).toBeGreaterThan(SHARE_CARD_BYTE_LIMIT);
    const fitted = fitShareCardBytes(png);
    expect(fitted.contentType).toBe("image/jpeg");
    expect(fitted.body.length).toBeLessThanOrEqual(SHARE_CARD_BYTE_LIMIT);
    expect(fitted.body.subarray(0, 2).toString("hex")).toBe("ffd8");
  }, 60_000);
});
