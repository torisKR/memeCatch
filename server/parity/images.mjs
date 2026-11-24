#!/usr/bin/env node
// `/_next/image`, Next's optimizer (sharp) against Axum's without upstream
// (src/standalone/image.rs). See README.md in this directory, "C1".
//
//   node server/parity/images.mjs <next> <axum> <public-dir>
//
// For each public image, at each width the pages ask for, with and without
// WebP in Accept: status and every header but `etag`, `content-length` and
// `x-nextjs-cache` must be equal (the encoders differ, so the bytes and their
// hash do), the images must have the same size, and the pixels must be
// within TOLERANCE. Then the refusals: every message of the checks.
// Both servers must serve the same public folder.
import { readdirSync, realpathSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sharp = createRequire(realpathSync(join(root, "node_modules/next/dist/compiled/@vercel/og/index.node.js")))("sharp");
const [nextBase, axumBase, publicDir] = process.argv.slice(2);
if (!nextBase || !axumBase || !publicDir) {
  console.error("usage: images.mjs <next> <axum> <public-dir>");
  process.exit(2);
}

/**
 * libvips (sharp) against the image crate's Lanczos 3 (premultiplied), then
 * libwebp, libjpeg or libpng; colours compared premultiplied. Measured on the
 * 40 public images at the widths below: from 384 px at most a mean of 3.50
 * per channel and 0.67 % of channels more than 32 apart (WebP, what browsers
 * get: 1.49 and 0.003 %). At 64 px sharp shrinks a JPEG while decoding it,
 * which blurs more than Lanczos from the full image: at most 9.58 and 6.64 %
 * (WebP 4.40 and 0.14 %); side by side those differ in sharpness only.
 */
const TOLERANCE = (width) => (width <= 64 ? { mean: 10, over32: 0.07 } : { mean: 4.5, over32: 0.012 });
/** Next re-encodes an AVIF source; Axum has no AVIF decoder and sends it as it is. No page asks for one. */
const KNOWN = (path) => path.endsWith(".avif");
const IGNORED = new Set(["date", "connection", "keep-alive", "transfer-encoding", "etag", "content-length", "x-nextjs-cache"]);
const host = new URL(nextBase).host;

function send(base, path, accept) {
  const url = new URL(base);
  return new Promise((done, fail) => {
    const request = http.request(
      { host: url.hostname, port: url.port, path, headers: { host, accept } },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => done({ status: response.statusCode, headers: response.headersDistinct, body: Buffer.concat(chunks) }));
      },
    );
    request.on("error", fail);
    request.end();
  });
}

function headerDifferences(a, b) {
  const names = new Set([...Object.keys(a.headers), ...Object.keys(b.headers)]);
  const out = [];
  for (const name of names) {
    if (IGNORED.has(name)) continue;
    const left = a.headers[name]?.join("\n");
    const right = b.headers[name]?.join("\n");
    if (left !== right) out.push(`${name}: ${left ?? "(absent)"} | ${right ?? "(absent)"}`);
  }
  return out;
}

/** Premultiplied: the colour of a transparent pixel is not seen, and encoders differ there. */
async function rgba(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    for (let channel = 0; channel < 3; channel += 1) data[index + channel] = Math.round((data[index + channel] * alpha) / 255);
  }
  return { data, width: info.width, height: info.height };
}

async function pixels(next, axum, width) {
  const [a, first] = await Promise.all([rgba(next), rgba(axum)]);
  let b = first;
  let size = "";
  // libvips shrinks a JPEG while loading it and rounds that height down, so
  // a height can come out one pixel shorter (og-signal.jpg at 64 px: 33 for
  // 33.6). The width is always the one asked for. Compared at Next's size.
  if (a.width === b.width && Math.abs(a.height - b.height) === 1) {
    b = await rgba(await sharp(axum).resize(a.width, a.height, { fit: "fill" }).png().toBuffer());
    size = ` (height ${first.height}, one pixel off)`;
  }
  if (a.width !== b.width || a.height !== b.height) return { ok: false, note: `size ${a.width}x${a.height} | ${b.width}x${b.height}` };
  let sum = 0;
  let over = 0;
  for (let index = 0; index < a.data.length; index += 1) {
    const delta = Math.abs(a.data[index] - b.data[index]);
    sum += delta;
    if (delta > 32) over += 1;
  }
  const mean = sum / a.data.length;
  const share = over / a.data.length;
  const limit = TOLERANCE(width);
  const ok = mean <= limit.mean && share <= limit.over32;
  return { ok, note: `${a.width}x${a.height}${size} mean ${mean.toFixed(3)} >32 ${(share * 100).toFixed(3)}%` };
}

function* images(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* images(full);
    else if (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(entry.name)) yield `/${relative(publicDir, full)}`;
  }
}

const WIDTHS = [64, 384, 640, 1080, 3840];
const ACCEPTS = ["*/*", "image/avif,image/webp,image/apng,*/*;q=0.8"];
let failed = 0;
let compared = 0;
for (const path of [...images(publicDir)].sort()) {
  for (const width of WIDTHS) {
    for (const accept of ACCEPTS) {
      const target = `/_next/image?url=${encodeURIComponent(path)}&w=${width}&q=75`;
      const [next, axum] = await Promise.all([send(nextBase, target, accept), send(axumBase, target, accept)]);
      const problems = [];
      if (next.status !== axum.status) problems.push(`status ${next.status} | ${axum.status}`);
      problems.push(...headerDifferences(next, axum));
      let note = "";
      if (next.status === 200 && axum.status === 200) {
        const result = await pixels(next.body, axum.body, width);
        note = result.note;
        if (!result.ok) problems.push(`pixels ${result.note}`);
      } else if (next.body.toString() !== axum.body.toString()) {
        problems.push(`body ${next.body.toString()} | ${axum.body.toString()}`);
      }
      compared += 1;
      const known = problems.length > 0 && KNOWN(path);
      if (problems.length && !known) failed += 1;
      const size = `${next.body.length}B/${axum.body.length}B`;
      const mark = known ? "known" : problems.length ? "DIFF" : "ok  ";
      console.log(`${mark} ${next.status} w=${width} ${accept === "*/*" ? "any " : "webp"} ${path} ${note} ${size}`);
      for (const problem of problems) console.log(`    ${problem}`);
    }
  }
}

const refusals = [
  "/_next/image",
  "/_next/image?w=64&q=75",
  "/_next/image?url=%2Fx.png&w=64",
  "/_next/image?url=%2Fx.png&q=75",
  "/_next/image?url=%2Fx.png&w=63&q=75",
  "/_next/image?url=%2Fx.png&w=-1&q=75",
  "/_next/image?url=%2Fx.png&w=abc&q=75",
  "/_next/image?url=%2Fx.png&w=64&q=80",
  "/_next/image?url=%2Fx.png&w=64&q=0",
  "/_next/image?url=%2Fx.png&w=64&q=101",
  "/_next/image?url=%2F%2Fx.png&w=64&q=75",
  "/_next/image?url=https%3A%2F%2Fi.ytimg.com%2Fx.jpg&w=64&q=75",
  "/_next/image?url=ftp%3A%2F%2Fx%2Fy.png&w=64&q=75",
  "/_next/image?url=x.png&w=64&q=75",
  "/_next/image?url=%2F_next%2Fimage%3Furl%3D%252Fx.png&w=64&q=75",
  "/_next/image?url=%2Fnope.png&w=64&q=75",
  "/_next/image?url=%2Fads.txt&w=64&q=75",
  "/_next/image?url=%2Fbrand%2Ffavicon.svg&w=64&q=75",
  "/_next/image?url=%2Fa&url=%2Fb&w=64&q=75",
];
for (const target of refusals) {
  const [next, axum] = await Promise.all([send(nextBase, target, "*/*"), send(axumBase, target, "*/*")]);
  const problems = [];
  if (next.status !== axum.status) problems.push(`status ${next.status} | ${axum.status}`);
  problems.push(...headerDifferences(next, axum));
  if (next.body.toString() !== axum.body.toString()) problems.push(`body ${next.body.toString()} | ${axum.body.toString()}`);
  compared += 1;
  if (problems.length) failed += 1;
  console.log(`${problems.length ? "DIFF" : "ok  "} ${next.status} ${target}`);
  for (const problem of problems) console.log(`    ${problem}`);
}

console.log(`\n${compared - failed} of ${compared} image requests match`);
process.exit(failed ? 1 : 0);
