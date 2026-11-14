import { deflateSync, inflateSync } from "node:zlib";

export type Raster = {
  width: number;
  height: number;
  rgba: Buffer;
};

function crc32(data: Buffer): number {
  let crc = ~0;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
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

export function decodePng(png: Buffer): Raster {
  if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error("not a png");
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  let colorType = 6;
  const idat: Buffer[] = [];
  while (pos + 8 <= png.length) {
    const length = png.readUInt32BE(pos);
    const type = png.toString("latin1", pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9] ?? 6;
      if (data[8] !== 8) throw new Error("unsupported png bit depth");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + length;
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!channels || width <= 0 || height <= 0) throw new Error("unsupported png");
  const raw = inflateSync(Buffer.concat(idat));
  const srcStride = width * channels;
  const rgba = Buffer.alloc(width * height * 4);
  let offset = 0;
  let previous = Buffer.alloc(srcStride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[offset] ?? 0;
    offset += 1;
    const row = Buffer.from(raw.subarray(offset, offset + srcStride));
    offset += srcStride;
    if (filter === 1) {
      for (let index = 0; index < srcStride; index += 1) {
        row[index] = (row[index]! + (index >= channels ? row[index - channels]! : 0)) & 255;
      }
    } else if (filter === 2) {
      for (let index = 0; index < srcStride; index += 1) {
        row[index] = (row[index]! + previous[index]!) & 255;
      }
    } else if (filter === 3) {
      for (let index = 0; index < srcStride; index += 1) {
        const left = index >= channels ? row[index - channels]! : 0;
        row[index] = (row[index]! + Math.floor((left + previous[index]!) / 2)) & 255;
      }
    } else if (filter === 4) {
      for (let index = 0; index < srcStride; index += 1) {
        const left = index >= channels ? row[index - channels]! : 0;
        const up = previous[index]!;
        const upLeft = index >= channels ? previous[index - channels]! : 0;
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
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const dest = (y * width + x) * 4;
      rgba[dest] = row[source] ?? 0;
      rgba[dest + 1] = row[source + 1] ?? 0;
      rgba[dest + 2] = row[source + 2] ?? 0;
      rgba[dest + 3] = channels === 4 ? row[source + 3] ?? 255 : 255;
    }
    previous = row;
  }
  return { width, height, rgba };
}
