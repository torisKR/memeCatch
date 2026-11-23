#!/usr/bin/env node
// Open Graph images, Next against Axum (src/routes/og.rs). See README.md in
// this directory, "Open Graph images".
//
//   node server/parity/og.mjs <next> <axum> [default] [quiz] [next-only]
//
// For an image: status and every header but `content-length` (the PNG
// encoders differ) must be equal, the PNGs must have the same size, and the
// pixels must be within TOLERANCE. Each image case writes
// server/target/og-parity/<case>.png: Next | Axum | the difference ×4.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { axumBase, compare, describe, expectEqual, fail, nextBase, pass, run, send } from "./harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// The sharp Next uses, found from next/og.
const sharp = createRequire(realpathSync(join(root, "node_modules/next/dist/compiled/@vercel/og/index.node.js")))("sharp");
const out = join(root, "server/target/og-parity");
mkdirSync(out, { recursive: true });

/**
 * The same SVG rasterized by libvips (Next) and resvg (Axum) differs only in
 * anti-aliased edges and gradient banding: measured at most 67 per channel,
 * a mean of 0.31, and 0.005 % of channels more than 32 apart.
 */
export const TOLERANCE = { mean: 0.5, over32: 0.0005, max: 96 };

async function rgba(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function pixels(label, next, axum) {
  const [a, b] = await Promise.all([rgba(next), rgba(axum)]);
  if (a.width !== b.width || a.height !== b.height) {
    return { ok: false, note: `size ${a.width}×${a.height} against ${b.width}×${b.height}` };
  }
  let max = 0;
  let sum = 0;
  let over32 = 0;
  const diff = Buffer.alloc(a.data.length);
  for (let i = 0; i < a.data.length; i += 1) {
    const d = Math.abs(a.data[i] - b.data[i]);
    max = Math.max(max, d);
    sum += d;
    if (d > 32) over32 += 1;
    diff[i] = (i & 3) === 3 ? 255 : Math.min(255, d * 4);
  }
  const mean = sum / a.data.length;
  const share = over32 / a.data.length;
  const raw = { raw: { width: a.width, height: a.height, channels: 4 } };
  await sharp({ create: { width: a.width * 3, height: a.height, channels: 4, background: "#000" } })
    .composite([
      { input: a.data, ...raw, left: 0, top: 0 },
      { input: b.data, ...raw, left: a.width, top: 0 },
      { input: diff, ...raw, left: 2 * a.width, top: 0 },
    ])
    .png()
    .toFile(join(out, `${label.replace(/[^\w.-]+/g, "_")}.png`));
  const ok = mean <= TOLERANCE.mean && share <= TOLERANCE.over32 && max <= TOLERANCE.max;
  return { ok, note: `${a.width}×${a.height} max ${max} mean ${mean.toFixed(3)} >32 ${(share * 100).toFixed(4)}%` };
}

const head = (response) => describe({ ...response, body: Buffer.from("<image>"), headers: withoutLength(response.headers) });
function withoutLength(headers) {
  const { "content-length": _, ...rest } = headers;
  return rest;
}

/** An image request: headers equal, pixels within tolerance. */
async function image(label, path, method = "GET") {
  const next = await send(nextBase, { method, path });
  const axum = await send(axumBase, { method, path });
  if (head(next) !== head(axum)) return fail(label, `next:\n${head(next)}\naxum:\n${head(axum)}`);
  if (method === "HEAD") return expectEqual(`${label}: empty body`, axum.body.length, 0);
  if (next.status !== 200) return fail(label, `both answered ${next.status}`);
  const result = await pixels(label, next.body, axum.body);
  if (result.ok) pass(label, result.note);
  else fail(label, result.note);
}

async function defaults() {
  for (const locale of ["ko", "en", "ja", "zh", "zh-tw", "ar"]) {
    await image(`og-${locale}`, `/og/${locale}`);
  }
  await image("og-ko-query", "/og/ko?v=3");
  await image("og-ko-head", "/og/ko", "HEAD");
  await image("opengraph-image", "/opengraph-image");
  await image("opengraph-image-query", "/opengraph-image?b8f3a1c2d4e5f6a7");
  await image("opengraph-image-head", "/opengraph-image", "HEAD");
}

const ids = (n) => Array.from({ length: n }, (_, i) => `q${String(i).padStart(7, "0")}`).join("");

/** Every total from 1 to 10, every grade band and mode, every score digit. */
export function quizTokens() {
  const tokens = [];
  const modes = "anr";
  for (let total = 1; total <= 10; total += 1) {
    for (let score = 0; score <= total; score += 1) {
      if (total > 3 && score % 2 === 1 && score !== total - 1 && score !== 1) continue;
      const mask = (1 << score) - 1;
      const rotated = total > 1 ? ((mask << 1) | (mask >> (total - 1))) & ((1 << total) - 1) : mask;
      tokens.push(modes[(total + score) % 3] + rotated.toString(16).padStart(3, "0") + ids(total));
    }
  }
  return tokens;
}

async function quiz() {
  for (const token of quizTokens()) await image(`quiz-${token}`, `/og/quiz/${token}`);
  await image("quiz-query", `/og/quiz/a005${ids(3)}?x=1`);
  await image("quiz-head", `/og/quiz/a005${ids(3)}`, "HEAD");
  for (const [label, token] of [
    ["too short", "a005"],
    ["bad mode", `x005${ids(3)}`],
    ["upper-case hex", `a00A${ids(3)}`],
    ["mask past the total", `a008${ids(3)}`],
    ["id of 7", `a005${ids(3)}q`],
    ["upper-case id", `a005${ids(2)}Q0000000`],
    ["repeated id", "a003q0000000q0000000"],
    ["eleven questions", `a000${ids(11)}`],
    ["dot in an id", `a001${"q000000."}`],
  ]) {
    await compare(`quiz 404: ${label}`, { path: `/og/quiz/${token}` }, { status: 404 });
  }
}

/** Answered by Next on both servers. */
async function nextOnly() {
  await compare("unknown locale", { path: "/og/xx" }, { status: 404 });
  await compare("encoded locale", { path: "/og/%6Bo" }, { status: 200 });
  await compare("trailing slash", { path: "/og/ko/" }, { status: 308 });
  await compare("POST /og/ko", { method: "POST", path: "/og/ko" }, { status: 200 });
  await compare("POST /opengraph-image", { method: "POST", path: "/opengraph-image" }, { status: 405 });
  await compare("POST quiz", { method: "POST", path: `/og/quiz/a005${ids(3)}` }, { status: 405 });
  await compare("encoded space before a quiz token", { path: `/og/quiz/%20a005${ids(3)}` }, { status: 200 });
}

await run({ default: defaults, quiz, "next-only": nextOnly });
