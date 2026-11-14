/**
 * Baseline JPEG (SOF0) to RGBA. Progressive and arithmetic JPEGs return null.
 * Enough for 4:2:0, 4:2:2, and 4:4:4 stills such as i.ytimg.com thumbnails.
 */

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

const COS = Array.from({ length: 8 }, (_, u) =>
  Array.from({ length: 8 }, (_, x) => Math.cos(((2 * x + 1) * u * Math.PI) / 16)),
);

type HuffNode = { symbol?: number; zero?: HuffNode; one?: HuffNode };

type Component = {
  id: number;
  h: number;
  v: number;
  quant: number;
};

type ScanComponent = {
  component: Component;
  dc: HuffNode;
  ac: HuffNode;
};

class Bits {
  private index = 0;
  private bit = 0;
  private current = 0;

  constructor(private readonly data: Uint8Array) {}

  read(count: number): number {
    let value = 0;
    for (let left = 0; left < count; left += 1) {
      if (this.bit === 0) {
        if (this.index >= this.data.length) return -1;
        this.current = this.data[this.index] ?? 0;
        this.index += 1;
        if (this.current === 0xff) {
          const stuffed = this.data[this.index] ?? 0;
          if (stuffed === 0x00) this.index += 1;
          else return -1;
        }
        this.bit = 8;
      }
      this.bit -= 1;
      value = (value << 1) | ((this.current >> this.bit) & 1);
    }
    return value;
  }
}

function huffman(counts: number[], symbols: number[]): HuffNode {
  const root: HuffNode = {};
  let code = 0;
  let index = 0;
  for (let length = 1; length <= 16; length += 1) {
    const count = counts[length - 1] ?? 0;
    for (let n = 0; n < count; n += 1) {
      let node = root;
      for (let bit = length - 1; bit >= 0; bit -= 1) {
        const one = ((code >> bit) & 1) === 1;
        const next = one ? node.one : node.zero;
        if (bit === 0) {
          const leaf: HuffNode = { symbol: symbols[index] ?? 0 };
          if (one) node.one = leaf;
          else node.zero = leaf;
        } else {
          const child = next ?? {};
          if (one) node.one = child;
          else node.zero = child;
          node = child;
        }
      }
      code += 1;
      index += 1;
    }
    code <<= 1;
  }
  return root;
}

function decodeSymbol(bits: Bits, root: HuffNode): number {
  let node = root;
  for (let guard = 0; guard < 16; guard += 1) {
    if (node.symbol != null) return node.symbol;
    const bit = bits.read(1);
    if (bit < 0) return -1;
    const next = bit === 0 ? node.zero : node.one;
    if (!next) return -1;
    node = next;
  }
  return node.symbol ?? -1;
}

function receive(bits: Bits, category: number): number {
  if (category === 0) return 0;
  const extra = bits.read(category);
  if (extra < 0) return 0;
  const threshold = 1 << (category - 1);
  return extra < threshold ? extra - (1 << category) + 1 : extra;
}

function idct(block: number[]): number[] {
  const out = new Array<number>(64);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      let sum = 0;
      for (let v = 0; v < 8; v += 1) {
        for (let u = 0; u < 8; u += 1) {
          const cu = u === 0 ? 1 / Math.SQRT2 : 1;
          const cv = v === 0 ? 1 / Math.SQRT2 : 1;
          const coeff = block[v * 8 + u] ?? 0;
          sum += cu * cv * coeff * (COS[u]?.[x] ?? 0) * (COS[v]?.[y] ?? 0);
        }
      }
      out[y * 8 + x] = 0.25 * sum;
    }
  }
  return out;
}

function decodeBlock(bits: Bits, dcTable: HuffNode, acTable: HuffNode, quant: number[], prevDc: number): { samples: number[]; dc: number } | null {
  const dcCat = decodeSymbol(bits, dcTable);
  if (dcCat < 0) return null;
  const dc = prevDc + receive(bits, dcCat);
  const zig = new Array<number>(64).fill(0);
  zig[0] = dc;
  for (let index = 1; index < 64;) {
    const symbol = decodeSymbol(bits, acTable);
    if (symbol < 0) return null;
    if (symbol === 0) break;
    if (symbol === 0xf0) {
      index += 16;
      continue;
    }
    index += symbol >> 4;
    const value = receive(bits, symbol & 0x0f);
    if (index < 64) zig[index] = value;
    index += 1;
  }
  const natural = new Array<number>(64).fill(0);
  for (let index = 0; index < 64; index += 1) {
    const slot = ZIGZAG[index] ?? index;
    natural[index] = (zig[slot] ?? 0) * (quant[index] ?? 1);
  }
  return { samples: idct(natural), dc };
}

function clampByte(value: number): number {
  if (value < 0) return 0;
  if (value > 255) return 255;
  return Math.round(value);
}

export function decodeBaselineJpeg(bytes: Uint8Array): { width: number; height: number; rgba: Buffer } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const quant: number[][] = [];
  const dcTables: HuffNode[] = [];
  const acTables: HuffNode[] = [];
  let width = 0;
  let height = 0;
  let components: Component[] = [];
  let offset = 2;
  let scan: ScanComponent[] | null = null;
  let scanOffset = 0;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset] ?? 0;
    offset += 1;
    if (marker === 0xd9) break;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return null;
    const start = offset + 2;
    const end = offset + length;
    if (marker === 0xdb) {
      let cursor = start;
      while (cursor < end) {
        const info = bytes[cursor] ?? 0;
        cursor += 1;
        if ((info & 0xf0) !== 0) return null;
        const table = new Array<number>(64);
        for (let index = 0; index < 64; index += 1) {
          const slot = ZIGZAG[index] ?? index;
          table[index] = bytes[cursor + slot] ?? 1;
        }
        quant[info & 0x0f] = table;
        cursor += 64;
      }
    } else if (marker === 0xc4) {
      let cursor = start;
      while (cursor < end) {
        const info = bytes[cursor] ?? 0;
        cursor += 1;
        const counts: number[] = [];
        let total = 0;
        for (let index = 0; index < 16; index += 1) {
          const count = bytes[cursor + index] ?? 0;
          counts.push(count);
          total += count;
        }
        cursor += 16;
        const symbols: number[] = [];
        for (let index = 0; index < total; index += 1) symbols.push(bytes[cursor + index] ?? 0);
        cursor += total;
        const tree = huffman(counts, symbols);
        const klass = info >> 4;
        const id = info & 0x0f;
        if (klass === 0) dcTables[id] = tree;
        else if (klass === 1) acTables[id] = tree;
        else return null;
      }
    } else if (marker === 0xc0) {
      height = ((bytes[start + 1] ?? 0) << 8) | (bytes[start + 2] ?? 0);
      width = ((bytes[start + 3] ?? 0) << 8) | (bytes[start + 4] ?? 0);
      const count = bytes[start + 5] ?? 0;
      if ((bytes[start] ?? 0) !== 8 || (count !== 1 && count !== 3) || width < 1 || height < 1) return null;
      components = [];
      for (let index = 0; index < count; index += 1) {
        const base = start + 6 + index * 3;
        const sampling = bytes[base + 1] ?? 0;
        components.push({
          id: bytes[base] ?? 0,
          h: sampling >> 4,
          v: sampling & 0x0f,
          quant: bytes[base + 2] ?? 0,
        });
      }
    } else if (marker === 0xc1 || marker === 0xc2 || (marker >= 0xc3 && marker <= 0xcf)) {
      return null;
    } else if (marker === 0xda) {
      const count = bytes[start] ?? 0;
      const parsed: ScanComponent[] = [];
      for (let index = 0; index < count; index += 1) {
        const id = bytes[start + 1 + index * 2] ?? 0;
        const tables = bytes[start + 2 + index * 2] ?? 0;
        const component = components.find((item) => item.id === id);
        const dc = dcTables[tables >> 4];
        const ac = acTables[tables & 0x0f];
        if (!component || !dc || !ac) return null;
        parsed.push({ component, dc, ac });
      }
      const spec = start + 1 + count * 2;
      if ((bytes[spec] ?? 0) !== 0 || (bytes[spec + 1] ?? 0) !== 63 || (bytes[spec + 2] ?? 0) !== 0) return null;
      scan = parsed;
      scanOffset = end;
      break;
    }
    offset = end;
  }

  if (!scan || width < 1 || height < 1) return null;
  const maxH = Math.max(...components.map((item) => item.h));
  const maxV = Math.max(...components.map((item) => item.v));
  if (maxH < 1 || maxH > 4 || maxV < 1 || maxV > 4) return null;
  const mcuCols = Math.ceil(width / (8 * maxH));
  const mcuRows = Math.ceil(height / (8 * maxV));
  const planes = new Map<number, { samples: Int16Array; sampleWidth: number; h: number; v: number }>();
  for (const component of components) {
    const sampleWidth = mcuCols * component.h * 8;
    const sampleHeight = mcuRows * component.v * 8;
    planes.set(component.id, {
      samples: new Int16Array(sampleWidth * sampleHeight),
      sampleWidth,
      h: component.h,
      v: component.v,
    });
  }
  const bits = new Bits(bytes.subarray(scanOffset));
  const dcPrev = new Map<number, number>();
  for (let mcuY = 0; mcuY < mcuRows; mcuY += 1) {
    for (let mcuX = 0; mcuX < mcuCols; mcuX += 1) {
      for (const item of scan) {
        const plane = planes.get(item.component.id);
        const table = quant[item.component.quant];
        if (!plane || !table) return null;
        for (let by = 0; by < item.component.v; by += 1) {
          for (let bx = 0; bx < item.component.h; bx += 1) {
            const decoded = decodeBlock(bits, item.dc, item.ac, table, dcPrev.get(item.component.id) ?? 0);
            if (!decoded) return null;
            dcPrev.set(item.component.id, decoded.dc);
            const originX = (mcuX * item.component.h + bx) * 8;
            const originY = (mcuY * item.component.v + by) * 8;
            for (let y = 0; y < 8; y += 1) {
              for (let x = 0; x < 8; x += 1) {
                plane.samples[(originY + y) * plane.sampleWidth + originX + x] = decoded.samples[y * 8 + x] ?? 0;
              }
            }
          }
        }
      }
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  const yPlane = planes.get(components[0]?.id ?? 1);
  const cbPlane = components[1] ? planes.get(components[1].id) : undefined;
  const crPlane = components[2] ? planes.get(components[2].id) : undefined;
  if (!yPlane) return null;
  const yScaleX = maxH / yPlane.h;
  const yScaleY = maxV / yPlane.v;
  const cbScaleX = cbPlane ? maxH / cbPlane.h : 1;
  const cbScaleY = cbPlane ? maxV / cbPlane.v : 1;
  const crScaleX = crPlane ? maxH / crPlane.h : 1;
  const crScaleY = crPlane ? maxV / crPlane.v : 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const luma = (yPlane.samples[Math.floor(y / yScaleY) * yPlane.sampleWidth + Math.floor(x / yScaleX)] ?? 0) + 128;
      let red = luma;
      let green = luma;
      let blue = luma;
      if (cbPlane && crPlane) {
        const cb = (cbPlane.samples[Math.floor(y / cbScaleY) * cbPlane.sampleWidth + Math.floor(x / cbScaleX)] ?? 0) + 128;
        const cr = (crPlane.samples[Math.floor(y / crScaleY) * crPlane.sampleWidth + Math.floor(x / crScaleX)] ?? 0) + 128;
        red = luma + 1.402 * (cr - 128);
        green = luma - 0.344136 * (cb - 128) - 0.714136 * (cr - 128);
        blue = luma + 1.772 * (cb - 128);
      }
      const pixel = (y * width + x) * 4;
      rgba[pixel] = clampByte(red);
      rgba[pixel + 1] = clampByte(green);
      rgba[pixel + 2] = clampByte(blue);
      rgba[pixel + 3] = 255;
    }
  }
  return { width, height, rgba };
}
