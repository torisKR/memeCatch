#!/usr/bin/env node
// Renders Open Graph cards through the app's own TSX with the Satori and
// sharp that `next/og` uses, and keeps Satori's SVG of each: the fixtures
// of tests/og_cards.rs. See README.md in this directory, "Open Graph images".
//
//   node server/parity/og-reference.mjs <out-dir> default <locale>...
//   node server/parity/og-reference.mjs <out-dir> quiz <token>...
//
// Writes <out-dir>/<name>.png (byte-identical to what Next serves) and
// <name>.svg. Names: default-<locale>, quiz-<token>.
import { cpSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const [out, kind, ...names] = process.argv.slice(2);
if (!out || !["default", "quiz"].includes(kind) || names.length === 0) {
  console.error("usage: og-reference.mjs <out-dir> default|quiz <locale-or-token>...");
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
globalThis.__ogRender = async (element, width, height, fonts) => {
  const svg = await satori(element, { width, height, debug: false, fonts });
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
try {
  const defaults = await server.ssrLoadModule("/lib/og-default-card.tsx");
  const quiz = await server.ssrLoadModule("/lib/quiz-og.tsx");
  const share = await server.ssrLoadModule("/lib/quiz-share.ts");
  for (const name of names) {
    globalThis.__ogSvg = null;
    const response = kind === "default"
      ? await defaults.renderOgDefaultImage(name)
      : await quiz.renderQuizResultOgImage(share.decodeQuizShareToken(name));
    const file = `${kind}-${name}`;
    writeFileSync(join(out, `${file}.png`), Buffer.from(await response.arrayBuffer()));
    if (globalThis.__ogSvg) writeFileSync(join(out, `${file}.svg`), globalThis.__ogSvg);
    console.log(file);
  }
} finally {
  await server.close();
  rmSync(scratch, { recursive: true, force: true });
}
