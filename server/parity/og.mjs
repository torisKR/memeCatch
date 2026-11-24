#!/usr/bin/env node
// Open Graph images, Next against Axum (src/routes/og.rs). See README.md in
// this directory, "Open Graph images".
//
//   node server/parity/og.mjs <next> <axum> [default] [quiz] [next-only] [share] [export]
//
// For an image: status and every header but `content-length` (the PNG
// encoders differ) must be equal, the PNGs must have the same size, and the
// pixels must be within TOLERANCE. Each image case writes
// server/target/og-parity/<case>.png: Next | Axum | the difference ×4.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { axumBase, compare, describe, expectEqual, fail, nextBase, pass, psql, run, send } from "./harness.mjs";

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

/**
 * The share cards (`og-meme`, `og-meme-locale`) on og-share-seed.sql. Both
 * servers run with LOCAL_OBJECT_STORAGE_DIR=server/target/og-parity/storage
 * (this writes the objects), Next with og-intercept.mjs and Axum with
 * AXUM_TEST_OG_ORIGIN, both pointing at the stub this runs on 127.0.0.1:3461.
 */
const photos = join(root, "server/tests/fixtures/og/photos");
const storage = join(out, "storage");
const stubbed = [];

async function startStub() {
  const youtube = await sharp(join(root, "public/ai-memes/italian-brainrot.jpg")).resize(1280, 720).jpeg({ quality: 85 }).toBuffer();
  const files = {
    "/i.ytimg.com/vi/R10ogVideo1/maxresdefault.jpg": youtube,
    "/i.ytimg.com/vi/R10ogSmall1/sddefault.jpg": readFileSync(join(photos, "jpeg-sd-bars.jpg")),
    "/i.ytimg.com/vi/R10ogSmall1/hqdefault.jpg": await sharp(youtube).resize(480, 360).jpeg({ quality: 80 }).toBuffer(),
  };
  const server = createServer((request, response) => {
    stubbed.push(request.url);
    const body = files[request.url];
    response.writeHead(body ? 200 : 404, { "content-type": body ? "application/octet-stream" : "text/plain" });
    response.end(body ?? "not found");
  });
  await new Promise((done) => server.listen(3461, "127.0.0.1", done));
  return server;
}

function placeObjects() {
  const put = (key, file) => {
    mkdirSync(dirname(join(storage, key)), { recursive: true });
    copyFileSync(join(photos, file), join(storage, key));
  };
  put("meme-card-art/r10-art.jpg", "jpeg-420.jpg");
  put("meme-card-art/r10-progressive.jpg", "jpeg-progressive.jpg");
  put("meme-card-art/r10-palette.png", "png-palette.png");
  put("meme-thumbs/verified/tiktok/7300000000000000001.jpg", "jpeg-bars.jpg");
}

/** The stub requests one card makes on one server. */
async function stubRequests(base, path) {
  stubbed.length = 0;
  await send(base, { path });
  return stubbed.filter((url) => url.startsWith("/i.ytimg.com/")).join(" ");
}

async function share() {
  placeObjects();
  const stub = await startStub();
  const korean = (key) => `/memes/${key}/opengraph-image-k2cx9c`;
  const keys = [
    ["title only", "r10og01-r10-og-01"], ["bare id", "r10og01"], ["stale slug", "r10og01-old"],
    ["encoded slug", "r10og01-%EC%A4%91%EC%9A%94"], ["card art", "r10og02"], ["YouTube ladder", "r10og03"],
    ["small YouTube still", "r10og04"], ["TikTok cover trimmed", "r10og05"], ["missing art", "r10og06"],
    ["Thai title", "r10og07"], ["emoji and ellipsis", "r10og08"], ["limited", "r10og09"],
    ["pending", "r10og10"], ["progressive art", "r10og11"], ["palette art", "r10og12"],
    ["translated meme in Korean", "r10og13"], ["still in public/", "r10og14"], ["curated, no row", "jkm2022k-jung-kkuk-ma"],
    ["curated alias", "cssqxwmb"], ["curated by id", "bjk2021k"], ["unknown key", "zzzzzzzz"],
    ["empty short id", "-x"],
  ];
  for (const [label, key] of keys) await image(`ko: ${label}`, korean(key));
  await compare("ko: bad escape (Next's 500)", { path: korean("r10og01-%E0%A4%A") }, { status: 500 });
  await image("ko: HEAD", korean("r10og02"), "HEAD");
  await compare("ko: POST", { method: "POST", path: korean("r10og01") }, { status: 405 });
  const locale = (code, key) => `/${code}/memes/${key}/opengraph-image`;
  for (const [label, path] of [
    ["en translated with art", locale("en", "r10og13")], ["ja stale translation", locale("ja", "r10og13")],
    ["zh translated", locale("zh", "r10og13")], ["zh-tw none", locale("zh-tw", "r10og13")],
    ["en untranslated", locale("en", "r10og01")], ["en unknown", locale("en", "zzzzzzzz")],
    ["ko segment", locale("ko", "r10og13")], ["ar segment", locale("ar", "r10og13")], ["xx segment", locale("xx", "r10og13")],
  ]) {
    await image(label, path);
  }
  await image("en: HEAD", locale("en", "r10og13"), "HEAD");
  for (const key of ["r10og03", "r10og04"]) {
    const [next, axum] = [await stubRequests(nextBase, korean(key)), await stubRequests(axumBase, korean(key))];
    expectEqual(`stub requests for ${key}`, axum, next);
  }
  stub.close();
}

/** The signed-in user README.md's better_auth_cookie.mjs mints. */
function signIn() {
  const user = process.env.PARITY_USER;
  if (!user) throw new Error("set PARITY_USER to a user from tests/better_auth_cookie.mjs");
  return JSON.parse(user).cookie;
}

/** `meme-export`: every answer before the card, signed out and in. */
async function exportCard() {
  const path = (query = "") => `/memes/r10og01/export${query}`;
  const cookie = signIn();
  const signedIn = { cookie };
  for (const [label, query, headers, status] of [
    ["signed out", "", {}, 401], ["signed out, en", "?locale=en", {}, 401],
    ["unknown locale", "?locale=xx", {}, 400], ["empty locale", "?locale=", {}, 400],
    ["Korean is not a content locale", "?locale=ko", signedIn, 400],
    ["signed in: no quota function", "", signedIn, 503], ["signed in, ja", "?locale=ja&template=bold&format=story", signedIn, 503],
    ["signed in, encoded zh-tw", "?locale=zh%2Dtw", signedIn, 503], ["unknown meme", "", signedIn, 503],
    ["bad cookie", "", { cookie: `${cookie}x` }, 401],
  ]) {
    await compare(`export: ${label}`, { path: path(query), headers }, { status });
  }
  await compare("export: HEAD", { method: "HEAD", path: path(), headers: signedIn }, { status: 503 });
  await compare("export: POST", { method: "POST", path: path(), headers: signedIn }, { status: 405 });
  // With the function in place the card is Next's: Axum hands it over.
  psql("create function public.reserve_meme_export() returns void language sql as $$ select $$;");
  try {
    await compare("export: quota function present", { path: path(), headers: signedIn });
  } finally {
    psql("drop function public.reserve_meme_export();");
  }
}

await run({ default: defaults, quiz, "next-only": nextOnly, share, export: exportCard });
