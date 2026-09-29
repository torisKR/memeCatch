import { describe, expect, it } from "vitest";
import {
  CreatorProductRasterError,
  inspectCreatorProductRaster,
} from "./raster";

const validPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2Y1sAAAAASUVORK5CYII=",
  "base64",
);

function structuralJpeg(width = 1, height = 1) {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x0b, 0x08,
    height >> 8, height & 0xff, width >> 8, width & 0xff,
    0x01, 0x01, 0x11, 0x00,
    0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0x00, 0xff, 0xd9,
  ]);
}

const validGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

function structuralWebp() {
  return Uint8Array.from([
    ...Buffer.from("RIFF"), 0x12, 0x00, 0x00, 0x00, ...Buffer.from("WEBP"),
    ...Buffer.from("VP8L"), 0x06, 0x00, 0x00, 0x00,
    0x2f, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
}

describe("creator product structural raster inspection", () => {
  it.each([
    ["image/png", validPng],
    ["image/jpeg", structuralJpeg()],
    ["image/gif", validGif],
    ["image/webp", structuralWebp()],
  ] as const)("extracts bounded dimensions from %s metadata", (mimeType, bytes) => {
    expect(inspectCreatorProductRaster(bytes, mimeType)).toEqual({ width: 1, height: 1 });
  });

  it.each([
    ["image/png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff])],
    ["image/gif", Uint8Array.from(Buffer.from("GIF89a"))],
    ["image/webp", Uint8Array.from(Buffer.from("RIFF0000WEBP"))],
  ] as const)("rejects a truncated %s signature", (mimeType, bytes) => {
    expect(() => inspectCreatorProductRaster(bytes, mimeType)).toThrow(CreatorProductRasterError);
  });

  it("rejects a WebP lossless metadata header without image payload", () => {
    const metadataOnly = Uint8Array.from([
      ...Buffer.from("RIFF"), 0x12, 0x00, 0x00, 0x00, ...Buffer.from("WEBP"),
      ...Buffer.from("VP8L"), 0x05, 0x00, 0x00, 0x00,
      0x2f, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    expect(() => inspectCreatorProductRaster(metadataOnly, "image/webp"))
      .toThrowError("invalid_structure");
  });

  it("rejects an animated WebP frame header without a nested image bitstream", () => {
    const frameHeaderOnly = Uint8Array.from([
      ...Buffer.from("RIFF"), 0x2e, 0x00, 0x00, 0x00, ...Buffer.from("WEBP"),
      ...Buffer.from("VP8X"), 0x0a, 0x00, 0x00, 0x00,
      0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ...Buffer.from("ANMF"), 0x10, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    expect(() => inspectCreatorProductRaster(frameHeaderOnly, "image/webp"))
      .toThrowError("invalid_structure");
  });

  it("rejects unreasonable dimensions and pixel counts", () => {
    expect(() => inspectCreatorProductRaster(structuralJpeg(9000, 1), "image/jpeg"))
      .toThrowError("invalid_dimensions");
    expect(() => inspectCreatorProductRaster(structuralJpeg(8000, 8000), "image/jpeg"))
      .toThrowError("too_many_pixels");
  });
});
