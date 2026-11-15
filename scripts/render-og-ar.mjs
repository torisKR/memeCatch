/**
 * Regenerates assets/og/ar.png with Chrome's HarfBuzz shaper.
 *
 * Satori paints the Arabic subset as isolated glyphs. This card is a
 * 1200×630 screenshot of the same layout the other locales draw, with the
 * committed Noto Sans Arabic Regular file:
 *
 *   version: 2.012
 *   name:    2.012;GOOG;NotoSansArabic-Regular
 *   sha256:  252e28731deedbb2df89e0960b974dba8e42138875d84806b6220f4a124c0dd5
 *   file:    assets/og-fonts/ar.ttf
 *
 * Authoring renderer: Google Chrome 157.0.8103.50.
 * QA measured the same font on Chrome 156. Joined ink at 64px must stay
 * within ±5% of شرح 132, الميمات 224, الكورية 180.
 *
 * Regenerate from the repo root:
 *   node scripts/render-og-ar.mjs
 * The script checks the font hash, screenshots the card, converts the RGB
 * capture to an RGBA PNG, and replaces assets/og/ar.png.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { deflateSync, inflateSync } from "node:zlib";

const execFileAsync = promisify(execFile);

export const ARABIC_FONT_VERSION = "2.012";
export const ARABIC_FONT_SHA256 = "252e28731deedbb2df89e0960b974dba8e42138875d84806b6220f4a124c0dd5";
export const ARABIC_FONT_NAME = "2.012;GOOG;NotoSansArabic-Regular";
export const ARABIC_WORD_WIDTHS = [
  { word: "شرح", px: 132 },
  { word: "الميمات", px: 224 },
  { word: "الكورية", px: 180 },
];

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FONT_PATH = join(ROOT, "assets/og-fonts/ar.ttf");
const OUTPUT_PATH = join(ROOT, "assets/og/ar.png");

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function decodeRgbPng(buffer) {
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
  if (colorType !== 2) throw new Error(`expected an RGB screenshot, got color type ${colorType}`);
  const inflated = inflateSync(Buffer.concat(idat));
  const stride = width * 3;
  const rows = [];
  let cursor = 0;
  const previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[cursor] ?? 0;
    cursor += 1;
    const row = Buffer.from(inflated.subarray(cursor, cursor + stride));
    cursor += stride;
    for (let index = 0; index < stride; index += 1) {
      const left = index >= 3 ? (row[index - 3] ?? 0) : 0;
      const up = previous[index] ?? 0;
      const upLeft = index >= 3 ? (previous[index - 3] ?? 0) : 0;
      const value = row[index] ?? 0;
      if (filter === 1) row[index] = (value + left) & 255;
      else if (filter === 2) row[index] = (value + up) & 255;
      else if (filter === 3) row[index] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const leftDistance = Math.abs(estimate - left);
        const upDistance = Math.abs(estimate - up);
        const upLeftDistance = Math.abs(estimate - upLeft);
        const predictor = leftDistance <= upDistance && leftDistance <= upLeftDistance
          ? left
          : upDistance <= upLeftDistance ? up : upLeft;
        row[index] = (value + predictor) & 255;
      }
    }
    previous.set(row);
    rows.push(row);
  }
  return { width, height, rows };
}

function encodeRgbaPng(width, height, rows) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const source = rows[y];
    const start = y * (stride + 1);
    raw[start] = 0;
    for (let x = 0; x < width; x += 1) {
      const from = x * 3;
      const to = start + 1 + x * 4;
      raw[to] = source[from] ?? 0;
      raw[to + 1] = source[from + 1] ?? 0;
      raw[to + 2] = source[from + 2] ?? 0;
      raw[to + 3] = 255;
    }
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

function cardHtml(fontUrl) {
  return `<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8">
<style>
@font-face {
  font-family: "OgSans";
  src: url("${fontUrl}") format("truetype");
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: "OgSans";
  src: url("${fontUrl}") format("truetype");
  font-weight: 700;
  font-style: normal;
}
html, body { margin: 0; width: 1200px; height: 630px; background: #131316; overflow: hidden; }
body {
  display: flex; align-items: center; justify-content: center;
  color: #f0efec; font-family: "OgSans", sans-serif; font-synthesis: none;
}
.group { display: flex; flex-direction: column; align-items: center; }
.brand { display: flex; align-items: center; }
.logo {
  width: 56px; height: 56px; border-radius: 16px; background: #F74610;
  display: flex; align-items: center; justify-content: center; flex: none;
}
.word { margin-left: 16px; font-size: 36px; font-weight: 700; line-height: 1; font-synthesis: none; }
.titles { display: flex; flex-direction: column; align-items: center; margin-top: 28px; gap: 48px; }
.line {
  font-size: 64px; font-weight: 400; line-height: 1; white-space: nowrap;
  direction: rtl; unicode-bidi: plaintext; font-synthesis: none;
}
</style>
</head>
<body>
  <div class="group">
    <div class="brand">
      <div class="logo">
        <svg width="38" height="38" viewBox="0 0 64 64" fill="none">
          <path d="M 37.4 11.7 A 21 21 0 1 0 52.9 33.8" stroke="#FFF9F5" stroke-width="10" stroke-linecap="round"/>
          <circle cx="49.2" cy="20" r="6" fill="#FFF9F5"/>
          <path fill="#FFF9F5" d="M14.5 44.5 10.5 58.5 25.5 53.5Z"/>
        </svg>
      </div>
      <div class="word">MemeCatch</div>
    </div>
    <div class="titles">
      <div class="line">شرح الميمات</div>
      <div class="line">الكورية</div>
    </div>
  </div>
</body>
</html>
`;
}

function measureJoinedWords(image) {
  const { width, height, rows } = image;
  const background = [rows[0][0], rows[0][1], rows[0][2]];
  const inkAt = (x, y) => {
    const index = x * 3;
    const row = rows[y];
    return row[index] !== background[0] || row[index + 1] !== background[1] || row[index + 2] !== background[2];
  };
  const rowHits = [];
  for (let y = 0; y < height; y += 1) {
    let ink = 0;
    for (let x = 0; x < width; x += 1) if (inkAt(x, y)) ink += 1;
    rowHits.push(ink >= 30);
  }
  const bands = [];
  let start = null;
  let gap = 0;
  for (let y = 0; y < rowHits.length; y += 1) {
    if (rowHits[y]) {
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
  if (start !== null) bands.push([start, height - 1]);
  const titleBands = bands.filter(([, bottom]) => bottom > 260);
  if (titleBands.length !== 2) {
    throw new Error(`expected two Arabic title bands, got ${titleBands.map((band) => band.join("-")).join(", ")}`);
  }
  const widths = titleBands.map(([top, bottom]) => {
    const xs = [];
    for (let x = 0; x < width; x += 1) {
      for (let y = top; y <= bottom; y += 1) {
        if (inkAt(x, y)) {
          xs.push(x);
          break;
        }
      }
    }
    const clusters = [];
    if (xs.length > 0) {
      let clusterStart = xs[0];
      let previous = xs[0];
      for (const x of xs.slice(1)) {
        if (x > previous + 14) {
          clusters.push(previous - clusterStart + 1);
          clusterStart = x;
        }
        previous = x;
      }
      clusters.push(previous - clusterStart + 1);
    }
    return clusters;
  });
  const [lineOne, lineTwo] = widths;
  return {
    memes: lineOne?.[0],
    explanation: lineOne?.[1],
    korean: lineTwo?.[0],
  };
}

function utf16be(value) {
  const units = Buffer.from(value, "utf16le");
  for (let index = 0; index < units.length; index += 2) {
    const first = units[index] ?? 0;
    units[index] = units[index + 1] ?? 0;
    units[index + 1] = first;
  }
  return units;
}

function assertWidth(actual, expected, word) {
  const delta = Math.abs(actual - expected) / expected;
  if (!Number.isFinite(actual) || delta > 0.05) {
    throw new Error(`${word} ink is ${actual}px; expected ${expected}px ±5%`);
  }
}

async function main() {
  const font = await readFile(FONT_PATH);
  const fontHash = createHash("sha256").update(font).digest("hex");
  if (fontHash !== ARABIC_FONT_SHA256) {
    throw new Error(`ar.ttf sha256 is ${fontHash}, expected ${ARABIC_FONT_SHA256}`);
  }
  if (!font.includes(utf16be(`Version ${ARABIC_FONT_VERSION}`))) {
    throw new Error(`ar.ttf is not Version ${ARABIC_FONT_VERSION}`);
  }
  const { stdout } = await execFileAsync("google-chrome", ["--version"]);
  const directory = await mkdtemp(join(tmpdir(), "og-ar-"));
  const htmlPath = join(directory, "card.html");
  const screenshotPath = join(directory, "card.png");
  await writeFile(htmlPath, cardHtml(`file://${FONT_PATH}`));
  await execFileAsync("timeout", [
    "18",
    "google-chrome",
    "--headless",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-sandbox",
    "--force-device-scale-factor=1",
    "--window-size=1200,630",
    "--virtual-time-budget=3000",
    `--screenshot=${screenshotPath}`,
    htmlPath,
  ]).catch((error) => {
    // Chrome keeps the dbus connection open after the screenshot is written.
    if (error?.code !== 124) throw error;
  });
  const decoded = decodeRgbPng(await readFile(screenshotPath));
  if (decoded.width !== 1200 || decoded.height !== 630) {
    throw new Error(`screenshot is ${decoded.width}x${decoded.height}`);
  }
  const measured = measureJoinedWords(decoded);
  assertWidth(measured.explanation, 132, "شرح");
  assertWidth(measured.memes, 224, "الميمات");
  assertWidth(measured.korean, 180, "الكورية");
  const png = encodeRgbaPng(decoded.width, decoded.height, decoded.rows);
  await mkdir(join(ROOT, "assets/og"), { recursive: true });
  await writeFile(OUTPUT_PATH, png);
  const outputHash = createHash("sha256").update(png).digest("hex");
  console.log(JSON.stringify({
    fontVersion: ARABIC_FONT_VERSION,
    fontName: ARABIC_FONT_NAME,
    fontSha256: fontHash,
    chrome: stdout.trim(),
    widths: measured,
    output: OUTPUT_PATH,
    sha256: outputHash,
    bytes: png.byteLength,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
