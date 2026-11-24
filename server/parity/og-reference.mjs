#!/usr/bin/env node
// Renders Open Graph cards through the app's own TSX with the Satori and
// sharp that `next/og` uses, and keeps Satori's SVG of each: the fixtures
// of tests/og_cards.rs. See README.md in this directory, "Open Graph images".
//
//   node server/parity/og-reference.mjs <out-dir> default <locale>...
//   node server/parity/og-reference.mjs <out-dir> quiz <token>...
//   node server/parity/og-reference.mjs <out-dir> share <cases.json>
//
// Writes <out-dir>/<name>.png (byte-identical to what Next serves) and
// <name>.svg. Names: default-<locale>, quiz-<token>, share-<case>. A
// share case also writes <name>.json: the
// answer's content type, and every extra font or emoji Satori asked for
// (Next would download those; here nothing is loaded).
//
// A share case is { name, locale, title, summary, year, category, photo }
// with `photo` a file path (the bytes the route would read) or absent.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [out, kind, ...names] = process.argv.slice(2);
if (!out || !["default", "quiz", "share"].includes(kind) || names.length === 0) {
  console.error("usage: og-reference.mjs <out-dir> default|quiz|share <locale-or-token-or-cases>...");
  process.exit(2);
}

// next/og is one bundle that keeps satori to itself. A copy that also
// exports it; sharp is loaded from where the bundle finds it.
const ogFile = realpathSync(join(root, "node_modules/next/dist/compiled/@vercel/og/index.node.js"));
const scratch = mkdtempSync(join(tmpdir(), "og-reference-"));
cpSync(dirname(ogFile), scratch, { recursive: true });
const bundle = join(scratch, "index.node.js");
const exported = readFileSync(bundle, "utf8").replace("export {\n  ImageResponse,", "export {\n  satori as __satori,\n  ImageResponse,");
if (!exported.includes("__satori")) throw new Error("the next/og bundle changed shape");
writeFileSync(bundle, exported);
const { __satori: satori } = await import(pathToFileURL(bundle).href);
const sharp = createRequire(ogFile)("sharp");

// `next/og` stand-in: what its render() does when sharp is installed.
const shim = join(scratch, "next-og.mjs");
writeFileSync(shim, `
export class ImageResponse extends Response {
  constructor(element, options = {}) {
    const width = options.width ?? 1200, height = options.height ?? 630;
    const png = globalThis.__ogRender(element, width, height, options.fonts);
    super(new ReadableStream({ async start(c) { c.enqueue(await png); c.close(); } }), {
      headers: { "content-type": "image/png", ...(options.headers ?? {}) },
    });
  }
}`);
// What Satori would hand next/og's loadDynamicAsset; nothing is loaded.
const loadAdditionalAsset = async (code, text) => {
  globalThis.__ogAssets.push({ code, text });
  return code === "emoji" ? undefined : [];
};
globalThis.__ogAssets = [];
globalThis.__ogRender = async (element, width, height, fonts) => {
  const svg = await satori(element, { width, height, debug: false, fonts, loadAdditionalAsset });
  globalThis.__ogSvg = svg;
  return sharp(new TextEncoder().encode(svg)).resize(width).png().toBuffer();
};

const vitePackage = createRequire(realpathSync(join(root, "node_modules/vitest/package.json")));
const vite = await import(pathToFileURL(vitePackage.resolve("vite")).href);
const server = await vite.createServer({
  root,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  resolve: { alias: [{ find: /^next\/og$/, replacement: shim }, { find: /^@\//, replacement: `${root}/` }] },
  ssr: { external: ["sharp"] },
});
process.chdir(root);
mkdirSync(out, { recursive: true });
const cases = (file) => JSON.parse(readFileSync(resolve(file), "utf8"));
async function shareCase(module, entry) {
  const photo = entry.photo ? readFileSync(resolve(entry.photo)) : null;
  const card = { locale: entry.locale, title: entry.title, summary: entry.summary ?? null, year: entry.year ?? null, category: entry.category ?? null, photoBytes: photo };
  return module.respondWithShareCard(entry.locale, card);
}

async function writeCase(file, response) {
  writeFileSync(join(out, `${file}.png`), Buffer.from(await response.arrayBuffer()));
  // An embedded photo is replaced by its type: photos.json holds its pixels.
  const svg = globalThis.__ogSvg?.replace(/href="data:(image\/[a-z]+);base64,[^"]*"/g, 'href="photo:$1"');
  if (svg) writeFileSync(join(out, `${file}.svg`), svg);
  const meta = { contentType: response.headers.get("content-type"), assets: globalThis.__ogAssets };
  writeFileSync(join(out, `${file}.json`), `${JSON.stringify(meta, null, 1)}\n`);
  console.log(file);
}

try {
  if (kind === "share") {
    const module = await server.ssrLoadModule("/lib/meme-share-card.tsx");
    for (const entry of names.flatMap(cases)) {
      globalThis.__ogSvg = null;
      globalThis.__ogAssets = [];
      const response = await shareCase(module, entry);
      await writeCase(`${kind}-${entry.name}`, response);
    }
  }
  const defaults = await server.ssrLoadModule("/lib/og-default-card.tsx");
  const quiz = await server.ssrLoadModule("/lib/quiz-og.tsx");
  const share = await server.ssrLoadModule("/lib/quiz-share.ts");
  for (const name of kind === "default" || kind === "quiz" ? names : []) {
    globalThis.__ogSvg = null;
    const response = kind === "default"
      ? await defaults.renderOgDefaultImage(name)
      : await quiz.renderQuizResultOgImage(share.decodeQuizShareToken(name));
    const file = `${kind}-${name}`;
    writeFileSync(join(out, `${file}.png`), Buffer.from(await response.arrayBuffer()));
    // An embedded photo is replaced by its type: photos.json holds its pixels.
  const svg = globalThis.__ogSvg?.replace(/href="data:(image\/[a-z]+);base64,[^"]*"/g, 'href="photo:$1"');
  if (svg) writeFileSync(join(out, `${file}.svg`), svg);
    console.log(file);
  }
} finally {
  await server.close();
  rmSync(scratch, { recursive: true, force: true });
}
