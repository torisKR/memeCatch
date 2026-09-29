const MAX_RASTER_DIMENSION = 8192;
const MAX_RASTER_PIXELS = 40_000_000;

export class CreatorProductRasterError extends Error {
  constructor(message: "invalid_structure" | "invalid_dimensions" | "too_many_pixels" | "unsupported_image") {
    super(message);
    this.name = "CreatorProductRasterError";
  }
}

type RasterDimensions = { width: number; height: number };

/**
 * Performs bounded signature, container, and dimension checks before storage.
 * This deliberately is not a full image decode and cannot prove every pixel is decodable.
 */
export function inspectCreatorProductRaster(bytes: Uint8Array, mimeType: string): RasterDimensions {
  const dimensions =
    mimeType === "image/png"
      ? inspectPng(bytes)
      : mimeType === "image/jpeg"
        ? inspectJpeg(bytes)
        : mimeType === "image/gif"
          ? inspectGif(bytes)
          : mimeType === "image/webp"
            ? inspectWebp(bytes)
            : fail("unsupported_image");

  if (
    !Number.isInteger(dimensions.width) ||
    !Number.isInteger(dimensions.height) ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > MAX_RASTER_DIMENSION ||
    dimensions.height > MAX_RASTER_DIMENSION
  ) {
    fail("invalid_dimensions");
  }
  if (dimensions.width * dimensions.height > MAX_RASTER_PIXELS) {
    fail("too_many_pixels");
  }
  return dimensions;
}

function inspectPng(bytes: Uint8Array): RasterDimensions {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 8 || !signature.every((value, index) => bytes[index] === value)) fail("invalid_structure");

  let cursor = 8;
  let dimensions: RasterDimensions | null = null;
  let sawIdat = false;
  let sawIend = false;
  let chunkIndex = 0;
  while (cursor < bytes.length) {
    if (cursor + 12 > bytes.length) fail("invalid_structure");
    const length = readU32Be(bytes, cursor);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) fail("invalid_structure");
    const type = ascii(bytes, cursor + 4, 4);

    if (chunkIndex === 0 && type !== "IHDR") fail("invalid_structure");
    if (type === "IHDR") {
      if (chunkIndex !== 0 || length !== 13 || dimensions) fail("invalid_structure");
      dimensions = { width: readU32Be(bytes, dataStart), height: readU32Be(bytes, dataStart + 4) };
    } else if (type === "IDAT") {
      if (!dimensions || length < 1 || sawIend) fail("invalid_structure");
      sawIdat = true;
    } else if (type === "IEND") {
      if (length !== 0 || !sawIdat) fail("invalid_structure");
      sawIend = true;
      cursor = chunkEnd;
      break;
    }

    cursor = chunkEnd;
    chunkIndex += 1;
  }
  if (!dimensions || !sawIdat || !sawIend || cursor !== bytes.length) fail("invalid_structure");
  return dimensions;
}

function inspectJpeg(bytes: Uint8Array): RasterDimensions {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) fail("invalid_structure");
  let cursor = 2;
  let dimensions: RasterDimensions | null = null;
  let sawScan = false;

  while (cursor < bytes.length) {
    if (bytes[cursor] !== 0xff) fail("invalid_structure");
    while (cursor < bytes.length && bytes[cursor] === 0xff) cursor += 1;
    if (cursor >= bytes.length) fail("invalid_structure");
    const marker = bytes[cursor++];
    if (marker === 0xd9) {
      if (!dimensions || !sawScan || cursor !== bytes.length) fail("invalid_structure");
      return dimensions;
    }
    if (marker === 0x00 || marker === 0xd8) fail("invalid_structure");
    if (marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) continue;
    if (cursor + 2 > bytes.length) fail("invalid_structure");
    const segmentLength = readU16Be(bytes, cursor);
    if (segmentLength < 2 || cursor + segmentLength > bytes.length) fail("invalid_structure");
    const dataStart = cursor + 2;
    const dataEnd = cursor + segmentLength;

    if (isStartOfFrame(marker)) {
      if (segmentLength < 8) fail("invalid_structure");
      dimensions = {
        width: readU16Be(bytes, dataStart + 3),
        height: readU16Be(bytes, dataStart + 1),
      };
    }
    cursor = dataEnd;
    if (marker === 0xda) {
      sawScan = true;
      let entropyBytes = 0;
      while (cursor < bytes.length - 1) {
        if (bytes[cursor] !== 0xff) {
          cursor += 1;
          entropyBytes += 1;
          continue;
        }
        const next = bytes[cursor + 1];
        if (next === 0x00 || next >= 0xd0 && next <= 0xd7) {
          cursor += 2;
          entropyBytes += 1;
          continue;
        }
        if (entropyBytes < 1) fail("invalid_structure");
        break;
      }
      if (cursor >= bytes.length - 1) fail("invalid_structure");
    }
  }
  fail("invalid_structure");
}

function inspectGif(bytes: Uint8Array): RasterDimensions {
  if (bytes.length < 13 || !["GIF87a", "GIF89a"].includes(ascii(bytes, 0, 6))) fail("invalid_structure");
  const dimensions = { width: readU16Le(bytes, 6), height: readU16Le(bytes, 8) };
  let cursor = 13;
  const packed = bytes[10];
  if (packed & 0x80) cursor += 3 * 2 ** ((packed & 0x07) + 1);
  if (cursor > bytes.length) fail("invalid_structure");
  let sawImage = false;

  while (cursor < bytes.length) {
    const introducer = bytes[cursor++];
    if (introducer === 0x3b) {
      if (!sawImage || cursor !== bytes.length) fail("invalid_structure");
      return dimensions;
    }
    if (introducer === 0x21) {
      if (cursor >= bytes.length) fail("invalid_structure");
      cursor += 1;
      cursor = skipGifSubBlocks(bytes, cursor);
      continue;
    }
    if (introducer !== 0x2c || cursor + 9 > bytes.length) fail("invalid_structure");
    const imagePacked = bytes[cursor + 8];
    cursor += 9;
    if (imagePacked & 0x80) cursor += 3 * 2 ** ((imagePacked & 0x07) + 1);
    if (cursor >= bytes.length) fail("invalid_structure");
    cursor += 1;
    cursor = skipGifSubBlocks(bytes, cursor);
    sawImage = true;
  }
  fail("invalid_structure");
}

function inspectWebp(bytes: Uint8Array): RasterDimensions {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") {
    fail("invalid_structure");
  }
  if (readU32Le(bytes, 4) + 8 !== bytes.length) fail("invalid_structure");
  let cursor = 12;
  let dimensions: RasterDimensions | null = null;
  let sawImage = false;

  while (cursor < bytes.length) {
    if (cursor + 8 > bytes.length) fail("invalid_structure");
    const type = ascii(bytes, cursor, 4);
    const length = readU32Le(bytes, cursor + 4);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + (length % 2);
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > bytes.length) fail("invalid_structure");

    if (type === "VP8X") {
      if (length !== 10) fail("invalid_structure");
      dimensions = {
        width: readU24Le(bytes, dataStart + 4) + 1,
        height: readU24Le(bytes, dataStart + 7) + 1,
      };
    } else if (type === "ANMF") {
      if (!dimensions || length <= 16) fail("invalid_structure");
      inspectAnimatedWebpFrame(bytes, dataStart + 16, dataEnd);
      sawImage = true;
    } else {
      const imageDimensions = inspectWebpBitstreamChunk(bytes, type, dataStart, length);
      if (imageDimensions) {
        dimensions ??= imageDimensions;
        sawImage = true;
      }
    }
    cursor = chunkEnd;
  }
  if (!dimensions || !sawImage || cursor !== bytes.length) fail("invalid_structure");
  return dimensions;
}

function inspectAnimatedWebpFrame(bytes: Uint8Array, start: number, end: number): void {
  let cursor = start;
  let sawImage = false;
  while (cursor < end) {
    if (cursor + 8 > end) fail("invalid_structure");
    const type = ascii(bytes, cursor, 4);
    const length = readU32Le(bytes, cursor + 4);
    const dataStart = cursor + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + (length % 2);
    if (!Number.isSafeInteger(chunkEnd) || chunkEnd > end) fail("invalid_structure");
    if (inspectWebpBitstreamChunk(bytes, type, dataStart, length)) sawImage = true;
    cursor = chunkEnd;
  }
  if (!sawImage || cursor !== end) fail("invalid_structure");
}

function inspectWebpBitstreamChunk(
  bytes: Uint8Array,
  type: string,
  dataStart: number,
  length: number,
): RasterDimensions | null {
  if (type === "VP8L") {
    if (length <= 5 || bytes[dataStart] !== 0x2f) fail("invalid_structure");
    const bits = readU32Le(bytes, dataStart + 1);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >>> 14) & 0x3fff) + 1,
    };
  }
  if (type === "VP8 ") {
    if (
      length <= 10 ||
      bytes[dataStart + 3] !== 0x9d ||
      bytes[dataStart + 4] !== 0x01 ||
      bytes[dataStart + 5] !== 0x2a
    ) {
      fail("invalid_structure");
    }
    return {
      width: readU16Le(bytes, dataStart + 6) & 0x3fff,
      height: readU16Le(bytes, dataStart + 8) & 0x3fff,
    };
  }
  return null;
}

function skipGifSubBlocks(bytes: Uint8Array, start: number): number {
  let cursor = start;
  while (cursor < bytes.length) {
    const length = bytes[cursor++];
    if (length === 0) return cursor;
    cursor += length;
    if (cursor > bytes.length) fail("invalid_structure");
  }
  fail("invalid_structure");
}

function isStartOfFrame(marker: number): boolean {
  return [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  if (start < 0 || start + length > bytes.length) fail("invalid_structure");
  return String.fromCharCode(...bytes.subarray(start, start + length));
}

function readU16Be(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.length) fail("invalid_structure");
  return bytes[offset] * 0x100 + bytes[offset + 1];
}

function readU16Le(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 2 > bytes.length) fail("invalid_structure");
  return bytes[offset] + bytes[offset + 1] * 0x100;
}

function readU24Le(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 3 > bytes.length) fail("invalid_structure");
  return bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000;
}

function readU32Be(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) fail("invalid_structure");
  return bytes[offset] * 0x1000000 + bytes[offset + 1] * 0x10000 + bytes[offset + 2] * 0x100 + bytes[offset + 3];
}

function readU32Le(bytes: Uint8Array, offset: number): number {
  if (offset < 0 || offset + 4 > bytes.length) fail("invalid_structure");
  return (bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000 + bytes[offset + 3] * 0x1000000) >>> 0;
}

function fail(reason: ConstructorParameters<typeof CreatorProductRasterError>[0]): never {
  throw new CreatorProductRasterError(reason);
}
