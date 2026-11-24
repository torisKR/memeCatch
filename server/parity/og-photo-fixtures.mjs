#!/usr/bin/env node
// The share card's photo handling, held to the TypeScript. See README.md in
// this directory, "Open Graph images".
//
//   node server/parity/og-photo-fixtures.mjs [--make]
//
// --make first writes the test photos into server/tests/fixtures/og/photos/
// (from a still in public/, with sharp and libjpeg-turbo's cjpeg for the
// samplings sharp does not write). Then, for every photo there, it records
// in server/tests/fixtures/og/photos.json what the app's own code does
// (`decodePng`, `decodeBaselineJpeg`, `prepareSharePhoto`) and what libvips
// decodes (the pixels Next's rasterizer paints), as SHA-256 of the RGBA, and
// the bytes of `encodeJpeg` at qualities 75 and 20 for two of them.
// tests/og_photo.rs compares the Rust with these.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = join(root, "server/tests/fixtures/og/photos");
const sharp = createRequire(realpathSync(join(root, "node_modules/next/dist/compiled/@vercel/og/index.node.js")))("sharp");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function make() {
  mkdirSync(dir, { recursive: true });
  const source = sharp(join(root, "public/ai-memes/italian-brainrot.jpg"));
  const at = (name) => join(dir, name);
  const ppm = async (width, height, file) => {
    const { data, info } = await source.clone().resize(width, height, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    writeFileSync(file, Buffer.concat([Buffer.from(`P6\n${info.width} ${info.height}\n255\n`), data]));
  };
  const cjpeg = (args, input, output) => execFileSync("cjpeg", [...args, "-outfile", output, input]);
  const scratch = join(dir, "source.ppm");
  await ppm(800, 450, scratch);
  cjpeg(["-quality", "85", "-sample", "2x2"], scratch, at("jpeg-420.jpg"));
  cjpeg(["-quality", "85", "-sample", "2x1"], scratch, at("jpeg-422.jpg"));
  cjpeg(["-quality", "85", "-sample", "1x2"], scratch, at("jpeg-440.jpg"));
  cjpeg(["-quality", "90", "-sample", "1x1"], scratch, at("jpeg-444.jpg"));
  cjpeg(["-quality", "85", "-restart", "4"], scratch, at("jpeg-restart.jpg"));
  cjpeg(["-quality", "85", "-progressive"], scratch, at("jpeg-progressive.jpg"));
  cjpeg(["-quality", "85", "-grayscale"], scratch, at("jpeg-gray.jpg"));
  // A 4:3 still with 30px bars and a noisy line: a trimmed photo.
  const inner = await source.clone().resize(720, 480, { fit: "cover" }).removeAlpha().raw().toBuffer();
  const barred = Buffer.alloc(720 * 540 * 3);
  inner.copy(barred, 30 * 720 * 3);
  for (let x = 0; x < 720; x += 7) barred[(29 * 720 + x) * 3] = 40;
  writeFileSync(scratch, Buffer.concat([Buffer.from("P6\n720 540\n255\n"), barred]));
  cjpeg(["-quality", "88"], scratch, at("jpeg-bars.jpg"));
  await sharp(barred, { raw: { width: 720, height: 540, channels: 3 } }).png().toFile(at("png-bars.png"));
  // sddefault: bars so tall the rest is under 400px.
  const sd = Buffer.alloc(640 * 480 * 3);
  (await source.clone().resize(640, 360, { fit: "cover" }).removeAlpha().raw().toBuffer()).copy(sd, 60 * 640 * 3);
  writeFileSync(scratch, Buffer.concat([Buffer.from("P6\n640 480\n255\n"), sd]));
  cjpeg(["-quality", "85"], scratch, at("jpeg-sd-bars.jpg"));
  await source.clone().resize(640, 480, { fit: "cover" }).png().toFile(at("png-rgb.png"));
  await source.clone().resize(450, 900, { fit: "cover" }).ensureAlpha(0.8).png().toFile(at("png-tall-rgba.png"));
  await source.clone().resize(600, 600, { fit: "cover" }).png({ palette: true }).toFile(at("png-palette.png"));
  await source.clone().resize(500, 500, { fit: "cover" }).toColourspace("rgb16").png().toFile(at("png-16bit.png"));
  await source.clone().resize(300, 300, { fit: "cover" }).png().toFile(at("png-small.png"));
  execFileSync("rm", [scratch]);
}

async function app() {
  const vitePackage = createRequire(realpathSync(join(root, "node_modules/vitest/package.json")));
  const vite = await import(pathToFileURL(vitePackage.resolve("vite")).href);
  const server = await vite.createServer({
    root, configFile: false, logLevel: "error", appType: "custom",
    server: { middlewareMode: true, hmr: false },
    resolve: { alias: [{ find: /^@\//, replacement: `${root}/` }] },
  });
  const modules = {
    png: await server.ssrLoadModule("/lib/png-raster.ts"),
    jpeg: await server.ssrLoadModule("/lib/jpeg-decode.ts"),
    photo: await server.ssrLoadModule("/lib/meme-share-photo.ts"),
    encode: await server.ssrLoadModule("/lib/jpeg-encode.ts"),
  };
  return { modules, close: () => server.close() };
}

function appRaster(modules, bytes) {
  try {
    const raster = bytes[0] === 0x89 ? modules.png.decodePng(bytes) : modules.jpeg.decodeBaselineJpeg(bytes);
    return raster ? { width: raster.width, height: raster.height, sha: sha(raster.rgba) } : null;
  } catch {
    return null;
  }
}

async function record() {
  const { modules, close } = await app();
  const photos = [];
  for (const name of readdirSync(dir).filter((n) => /\.(png|jpg)$/.test(n)).sort()) {
    const bytes = readFileSync(join(dir, name));
    const prepared = modules.photo.prepareSharePhoto(bytes);
    let embedded = null;
    if (prepared) {
      const [, mime, data] = /^data:(image\/[a-z]+);base64,(.*)$/.exec(prepared.dataUrl);
      const inner = Buffer.from(data, "base64");
      embedded = { mime, original: inner.equals(bytes), app: appRaster(modules, inner) };
    }
    const vips = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    photos.push({
      name,
      app: appRaster(modules, bytes),
      prepared: prepared ? { width: prepared.width, height: prepared.height, embedded } : null,
      vips: { width: vips.info.width, height: vips.info.height, sha: sha(vips.data) },
    });
  }
  const encodings = [];
  for (const name of ["png-rgb.png", "png-bars.png"]) {
    const raster = modules.png.decodePng(readFileSync(join(dir, name)));
    for (const quality of [75, 20]) {
      const jpeg = modules.encode.encodeJpeg(raster, quality);
      encodings.push({ name, quality, length: jpeg.length, sha: sha(jpeg) });
    }
  }
  await close();
  writeFileSync(join(root, "server/tests/fixtures/og/photos.json"), `${JSON.stringify({ photos, encodings }, null, 1)}\n`);
  console.log(`${photos.length} photos, ${encodings.length} encodings`);
}

if (process.argv.includes("--make")) await make();
await record();
