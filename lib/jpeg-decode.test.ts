import { describe, expect, it } from "vitest";
import { encodeJpeg } from "@/lib/jpeg-encode";
import { decodeBaselineJpeg } from "@/lib/jpeg-decode";

describe("baseline jpeg decode", () => {
  it("round-trips a solid color from the share-card encoder", () => {
    const width = 32;
    const height = 24;
    const rgba = Buffer.alloc(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      rgba[index * 4] = 220;
      rgba[index * 4 + 1] = 30;
      rgba[index * 4 + 2] = 40;
      rgba[index * 4 + 3] = 255;
    }
    const decoded = decodeBaselineJpeg(encodeJpeg({ width, height, rgba }, 90));
    expect(decoded?.width).toBe(width);
    expect(decoded?.height).toBe(height);
    expect(decoded?.rgba[0]).toBeGreaterThan(180);
    expect(decoded?.rgba[1]).toBeLessThan(80);
    expect(decoded?.rgba[2]).toBeLessThan(90);
  });
});
