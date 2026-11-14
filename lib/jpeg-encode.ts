import { decodePng, type Raster } from "@/lib/png-raster";

const ZIGZAG = [
  0, 1, 5, 6, 14, 15, 27, 28,
  2, 4, 7, 13, 16, 26, 29, 42,
  3, 8, 12, 17, 25, 30, 41, 43,
  9, 11, 18, 24, 31, 40, 44, 53,
  10, 19, 23, 32, 39, 45, 52, 54,
  20, 22, 33, 38, 46, 51, 55, 60,
  21, 34, 37, 47, 50, 56, 59, 61,
  35, 36, 48, 49, 57, 58, 62, 63,
];

const QUANT_LUMA = [
  16, 11, 10, 16, 24, 40, 51, 61,
  12, 12, 14, 19, 26, 58, 60, 55,
  14, 13, 16, 24, 40, 57, 69, 56,
  14, 17, 22, 29, 51, 87, 80, 62,
  18, 22, 37, 56, 68, 109, 103, 77,
  24, 35, 55, 64, 81, 104, 113, 92,
  49, 64, 78, 87, 103, 121, 120, 101,
  72, 92, 95, 98, 112, 100, 103, 99,
];

const QUANT_CHROMA = [
  17, 18, 24, 47, 99, 99, 99, 99,
  18, 21, 26, 66, 99, 99, 99, 99,
  24, 26, 56, 99, 99, 99, 99, 99,
  47, 66, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
  99, 99, 99, 99, 99, 99, 99, 99,
];

const DC_LUMA_BITS = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0];
const DC_LUMA_VAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const DC_CHROMA_BITS = [0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0];
const DC_CHROMA_VAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const AC_LUMA_BITS = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d];
const AC_LUMA_VAL = [
  0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
  0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
  0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
  0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
  0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
  0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
  0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
  0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
  0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
  0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
];
const AC_CHROMA_BITS = [0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77];
const AC_CHROMA_VAL = [
  0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71,
  0x13, 0x22, 0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xa1, 0xb1, 0xc1, 0x09, 0x23, 0x33, 0x52, 0xf0,
  0x15, 0x62, 0x72, 0xd1, 0x0a, 0x16, 0x24, 0x34, 0xe1, 0x25, 0xf1, 0x17, 0x18, 0x19, 0x1a, 0x26,
  0x27, 0x28, 0x29, 0x2a, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48,
  0x49, 0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68,
  0x69, 0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
  0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5,
  0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3,
  0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda,
  0xe2, 0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
  0xf9, 0xfa,
];

type Huffman = { code: number; length: number };

function buildHuffman(counts: number[], values: number[]): Huffman[] {
  const table: Huffman[] = Array.from({ length: 256 }, () => ({ code: 0, length: 0 }));
  let code = 0;
  let index = 0;
  for (let length = 1; length <= 16; length += 1) {
    for (let count = 0; count < (counts[length - 1] ?? 0); count += 1) {
      const value = values[index] ?? 0;
      table[value] = { code, length };
      code += 1;
      index += 1;
    }
    code <<= 1;
  }
  return table;
}

const HUFF_DC_Y = buildHuffman(DC_LUMA_BITS, DC_LUMA_VAL);
const HUFF_DC_C = buildHuffman(DC_CHROMA_BITS, DC_CHROMA_VAL);
const HUFF_AC_Y = buildHuffman(AC_LUMA_BITS, AC_LUMA_VAL);
const HUFF_AC_C = buildHuffman(AC_CHROMA_BITS, AC_CHROMA_VAL);

function scaleQuant(base: number[], quality: number): number[] {
  const clamped = Math.max(1, Math.min(100, quality));
  const scale = clamped < 50 ? Math.floor(5000 / clamped) : 200 - clamped * 2;
  return base.map((value) => Math.min(255, Math.max(1, Math.floor((value * scale + 50) / 100))));
}

class BitWriter {
  private bytes: number[] = [];
  private bit = 0;
  private acc = 0;

  write(code: number, length: number) {
    if (length === 0) return;
    this.acc = (this.acc << length) | (code & ((1 << length) - 1));
    this.bit += length;
    while (this.bit >= 8) {
      this.bit -= 8;
      const byte = (this.acc >> this.bit) & 0xff;
      this.bytes.push(byte);
      if (byte === 0xff) this.bytes.push(0);
    }
  }

  finish(): Buffer {
    if (this.bit > 0) {
      const byte = ((this.acc << (8 - this.bit)) | ((1 << (8 - this.bit)) - 1)) & 0xff;
      this.bytes.push(byte);
      if (byte === 0xff) this.bytes.push(0);
      this.bit = 0;
    }
    return Buffer.from(this.bytes);
  }
}

const COS = Array.from({ length: 8 }, (_, u) =>
  Array.from({ length: 8 }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / 16)),
);

function dctBlock(samples: number[], quant: number[]): number[] {
  const out = new Array<number>(64).fill(0);
  for (let v = 0; v < 8; v += 1) {
    for (let u = 0; u < 8; u += 1) {
      let sum = 0;
      for (let y = 0; y < 8; y += 1) {
        for (let x = 0; x < 8; x += 1) {
          sum += (samples[y * 8 + x] ?? 0) * (COS[u]?.[x] ?? 0) * (COS[v]?.[y] ?? 0);
        }
      }
      const cu = u === 0 ? 1 / Math.SQRT2 : 1;
      const cv = v === 0 ? 1 / Math.SQRT2 : 1;
      const coeff = 0.25 * cu * cv * sum;
      const slot = ZIGZAG[v * 8 + u] ?? 0;
      const q = quant[v * 8 + u] ?? 1;
      const quantized = Math.round(coeff / q);
      out[slot] = Math.max(-2047, Math.min(2047, quantized));
    }
  }
  return out;
}

function categoryOf(value: number): number {
  const abs = Math.abs(value);
  if (abs === 0) return 0;
  return Math.floor(Math.log2(abs)) + 1;
}

function writeBlock(writer: BitWriter, block: number[], dcTable: Huffman[], acTable: Huffman[], prevDc: number): number {
  const dc = block[0] ?? 0;
  const diff = dc - prevDc;
  const dcCat = categoryOf(diff);
  const dcCode = dcTable[dcCat];
  if (!dcCode || dcCode.length === 0) throw new Error("missing dc huffman");
  writer.write(dcCode.code, dcCode.length);
  if (dcCat > 0) {
    const extra = diff < 0 ? diff + (1 << dcCat) - 1 : diff;
    writer.write(extra, dcCat);
  }
  let zero = 0;
  for (let index = 1; index < 64; index += 1) {
    const value = block[index] ?? 0;
    if (value === 0) {
      zero += 1;
      continue;
    }
    while (zero >= 16) {
      const zrl = acTable[0xf0];
      if (!zrl || zrl.length === 0) throw new Error("missing zrl");
      writer.write(zrl.code, zrl.length);
      zero -= 16;
    }
    const cat = categoryOf(value);
    const symbol = (zero << 4) | cat;
    const code = acTable[symbol];
    if (!code || code.length === 0) throw new Error(`missing ac huffman ${symbol}`);
    writer.write(code.code, code.length);
    const extra = value < 0 ? value + (1 << cat) - 1 : value;
    writer.write(extra, cat);
    zero = 0;
  }
  if (zero > 0) {
    const eob = acTable[0];
    if (!eob || eob.length === 0) throw new Error("missing eob");
    writer.write(eob.code, eob.length);
  }
  return dc;
}

function marker(bytes: number[], markerId: number, payload?: Buffer) {
  bytes.push(0xff, markerId);
  if (!payload) return;
  const length = payload.length + 2;
  bytes.push((length >> 8) & 0xff, length & 0xff);
  for (const byte of payload) bytes.push(byte);
}

function samplePlane(raster: Raster, mcuX: number, mcuY: number, channel: "y" | "cb" | "cr", blockX: number, blockY: number): number[] {
  const samples = new Array<number>(64);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const pixelX = Math.min(raster.width - 1, mcuX * 16 + blockX * 8 + x);
      const pixelY = Math.min(raster.height - 1, mcuY * 16 + blockY * 8 + y);
      const index = (pixelY * raster.width + pixelX) * 4;
      const r = raster.rgba[index] ?? 0;
      const g = raster.rgba[index + 1] ?? 0;
      const b = raster.rgba[index + 2] ?? 0;
      let value = 0;
      if (channel === "y") value = 0.299 * r + 0.587 * g + 0.114 * b;
      else if (channel === "cb") value = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      else value = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      samples[y * 8 + x] = value - 128;
    }
  }
  return samples;
}

function chromaAverage(raster: Raster, mcuX: number, mcuY: number, channel: "cb" | "cr"): number[] {
  const samples = new Array<number>(64);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      let total = 0;
      for (let dy = 0; dy < 2; dy += 1) {
        for (let dx = 0; dx < 2; dx += 1) {
          const pixelX = Math.min(raster.width - 1, mcuX * 16 + x * 2 + dx);
          const pixelY = Math.min(raster.height - 1, mcuY * 16 + y * 2 + dy);
          const index = (pixelY * raster.width + pixelX) * 4;
          const r = raster.rgba[index] ?? 0;
          const g = raster.rgba[index + 1] ?? 0;
          const b = raster.rgba[index + 2] ?? 0;
          total += channel === "cb"
            ? 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
            : 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        }
      }
      samples[y * 8 + x] = total / 4 - 128;
    }
  }
  return samples;
}

/** Baseline 4:2:0 JPEG. Quality is 1–100. */
export function encodeJpeg(raster: Raster, quality = 75): Buffer {
  const quantY = scaleQuant(QUANT_LUMA, quality);
  const quantC = scaleQuant(QUANT_CHROMA, quality);
  const header: number[] = [];
  marker(header, 0xd8);
  marker(header, 0xe0, Buffer.from([
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]));
  const dqt = Buffer.alloc(65 * 2);
  dqt[0] = 0;
  quantY.forEach((value, index) => {
    dqt[1 + (ZIGZAG[index] ?? index)] = value;
  });
  dqt[65] = 1;
  quantC.forEach((value, index) => {
    dqt[66 + (ZIGZAG[index] ?? index)] = value;
  });
  marker(header, 0xdb, dqt);
  const sof = Buffer.alloc(15);
  sof[0] = 8;
  sof.writeUInt16BE(raster.height, 1);
  sof.writeUInt16BE(raster.width, 3);
  sof[5] = 3;
  sof[6] = 1;
  sof[7] = 0x22;
  sof[8] = 0;
  sof[9] = 2;
  sof[10] = 0x11;
  sof[11] = 1;
  sof[12] = 3;
  sof[13] = 0x11;
  sof[14] = 1;
  marker(header, 0xc0, sof);
  const dhtParts = [
    huffmanSegment(0x00, DC_LUMA_BITS, DC_LUMA_VAL),
    huffmanSegment(0x10, AC_LUMA_BITS, AC_LUMA_VAL),
    huffmanSegment(0x01, DC_CHROMA_BITS, DC_CHROMA_VAL),
    huffmanSegment(0x11, AC_CHROMA_BITS, AC_CHROMA_VAL),
  ];
  marker(header, 0xc4, Buffer.concat(dhtParts));
  marker(header, 0xda, Buffer.from([0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00]));
  const writer = new BitWriter();
  let dcY = 0;
  let dcCb = 0;
  let dcCr = 0;
  const mcuRows = Math.ceil(raster.height / 16);
  const mcuCols = Math.ceil(raster.width / 16);
  for (let mcuY = 0; mcuY < mcuRows; mcuY += 1) {
    for (let mcuX = 0; mcuX < mcuCols; mcuX += 1) {
      for (const [blockX, blockY] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const block = dctBlock(samplePlane(raster, mcuX, mcuY, "y", blockX, blockY), quantY);
        dcY = writeBlock(writer, block, HUFF_DC_Y, HUFF_AC_Y, dcY);
      }
      dcCb = writeBlock(writer, dctBlock(chromaAverage(raster, mcuX, mcuY, "cb"), quantC), HUFF_DC_C, HUFF_AC_C, dcCb);
      dcCr = writeBlock(writer, dctBlock(chromaAverage(raster, mcuX, mcuY, "cr"), quantC), HUFF_DC_C, HUFF_AC_C, dcCr);
    }
  }
  const scan = writer.finish();
  return Buffer.concat([Buffer.from(header), scan, Buffer.from([0xff, 0xd9])]);
}

function huffmanSegment(classId: number, counts: number[], values: number[]): Buffer {
  const body = Buffer.alloc(1 + 16 + values.length);
  body[0] = classId;
  counts.forEach((count, index) => {
    body[1 + index] = count;
  });
  values.forEach((value, index) => {
    body[17 + index] = value;
  });
  return body;
}

export const SHARE_CARD_BYTE_LIMIT = 1_000_000;

/** Keep a PNG when it is within the KakaoTalk limit. Otherwise emit JPEG. */
export function fitShareCardBytes(png: Buffer): { body: Buffer; contentType: "image/png" | "image/jpeg" } {
  if (png.length <= SHARE_CARD_BYTE_LIMIT) return { body: png, contentType: "image/png" };
  const raster = decodePng(png);
  for (const quality of [75, 60, 45, 30]) {
    const jpeg = encodeJpeg(raster, quality);
    if (jpeg.length <= SHARE_CARD_BYTE_LIMIT) return { body: jpeg, contentType: "image/jpeg" };
  }
  const smallest = encodeJpeg(raster, 20);
  if (smallest.length <= SHARE_CARD_BYTE_LIMIT) return { body: smallest, contentType: "image/jpeg" };
  return { body: png, contentType: "image/png" };
}
