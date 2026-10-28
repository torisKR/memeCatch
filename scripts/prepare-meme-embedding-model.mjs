#!/usr/bin/env node
/** Prepare pinned FP32 model assets at build time; never import this from a request handler. */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MODEL_ID = "intfloat/multilingual-e5-small";
export const MODEL_REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
export const DEFAULT_MODEL_DIRECTORY = fileURLToPath(new URL(`../.local/embedding-models/${MODEL_ID}/`, import.meta.url));
const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 60_000;
const HTTP_DATE_PATTERN = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$/;

// Official Hub tree metadata at MODEL_REVISION. Git-tracked files use Git blob SHA-1;
// LFS files use SHA-256 of their actual contents, never the small LFS pointer.
// https://huggingface.co/api/models/intfloat/multilingual-e5-small/tree/614241f622f53c4eeff9890bdc4f31cfecc418b3
// https://huggingface.co/api/models/intfloat/multilingual-e5-small/tree/614241f622f53c4eeff9890bdc4f31cfecc418b3/onnx
export const MODEL_FILES = Object.freeze([
  { path: "config.json", size: 655, algorithm: "git-sha1", digest: "60a2a84020f1d74cc53ea9e8c4e91cf4af6c2b68" },
  { path: "tokenizer.json", size: 17082730, algorithm: "sha256", digest: "0b44a9d7b51c3c62626640cda0e2c2f70fdacdc25bbbd68038369d14ebdf4c39" },
  { path: "special_tokens_map.json", size: 167, algorithm: "git-sha1", digest: "e0b1d18ecd0ae4ff1d47bd297d910c0cf83e504b" },
  { path: "tokenizer_config.json", size: 443, algorithm: "git-sha1", digest: "059214673d9d6d2ee319411e2ffec8c024b816d5" },
  { path: "onnx/model.onnx", size: 470268510, algorithm: "sha256", digest: "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665" },
].map(Object.freeze));

function validateFile(file) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(file.path)
    || file.path.split("/").some((part) => !part || part === "." || part === "..")
    || !Number.isSafeInteger(file.size) || file.size < 1
    || !["git-sha1", "sha256"].includes(file.algorithm)
    || !(file.algorithm === "sha256" ? /^[a-f0-9]{64}$/ : /^[a-f0-9]{40}$/).test(file.digest)) {
    throw new Error("invalid_model_file_manifest");
  }
}

function fileHash(file) {
  const hash = createHash(file.algorithm === "git-sha1" ? "sha1" : "sha256");
  if (file.algorithm === "git-sha1") hash.update(`blob ${file.size}\0`);
  return hash;
}

async function verifyFile(directory, file) {
  validateFile(file);
  const path = join(directory, file.path);
  let stat;
  try { stat = await lstat(path); } catch (error) {
    if (error.code === "ENOENT") return { status: "missing" };
    throw error;
  }
  if (!stat.isFile() || stat.size !== file.size) return { status: "invalid" };
  const hash = fileHash(file);
  const sha256 = file.algorithm === "sha256" ? hash : createHash("sha256");
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    if (sha256 !== hash) sha256.update(chunk);
  }
  const digest = hash.digest("hex");
  return digest === file.digest
    ? { status: "valid", bytes: file.size, sha256: sha256 === hash ? digest : sha256.digest("hex") }
    : { status: "invalid" };
}

function trustedDownloadUrl(value) {
  const url = new URL(value);
  const host = url.hostname;
  const trusted = host === "huggingface.co"
    || host === "cdn-lfs.huggingface.co"
    || /^cdn-lfs-(?:us|eu)-\d+\.huggingface\.co$/.test(host)
    || host === "cdn-lfs.hf.co"
    || /^cdn-lfs-(?:us|eu)-\d+\.hf\.co$/.test(host)
    || host === "cas-bridge.xethub.hf.co"
    || /^[a-z0-9-]+\.(?:aws|gcp|azure)\.cdn\.hf\.co$/.test(host);
  if (url.protocol !== "https:" || url.username || url.password
    || (url.port && url.port !== "443") || !trusted) {
    throw new Error("untrusted_model_download_url");
  }
  return url;
}

function retryAfterDelay(value, now) {
  if (value === null) return null;
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    return Number.isSafeInteger(seconds) ? seconds * 1_000 : Number.POSITIVE_INFINITY;
  }
  if (!HTTP_DATE_PATTERN.test(normalized)) return null;
  const date = Date.parse(normalized);
  return Number.isFinite(date) && new Date(date).toUTCString() === normalized
    ? Math.max(0, date - now) : null;
}

async function abortableWait(delay, signal) {
  signal?.throwIfAborted();
  if (delay === 0) return;
  await new Promise((resolveWait, rejectWait) => {
    let timer;
    const onAbort = () => {
      clearTimeout(timer);
      rejectWait(signal.reason ?? new Error("model_download_interrupted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) return onAbort();
    timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolveWait();
    }, delay);
  });
}

async function fetchModelFile(file, fetchImpl, signal, waitImpl, nowImpl) {
  let url = trustedDownloadUrl(`https://huggingface.co/${MODEL_ID}/resolve/${MODEL_REVISION}/${file.path}`);
  let redirects = 0;
  let rateLimitRetries = 0;
  while (true) {
    const response = await fetchImpl(url.href, {
      redirect: "manual", credentials: "omit", signal,
      headers: { Accept: "application/octet-stream" },
    });
    if (response.url) trustedDownloadUrl(response.url);
    const revision = response.headers.get("x-repo-commit");
    if (revision && revision !== MODEL_REVISION) {
      await response.body?.cancel();
      throw new Error("model_revision_mismatch");
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirects === 5) throw new Error("model_redirect_limit");
      redirects++;
      url = trustedDownloadUrl(new URL(location, url).href);
      continue;
    }
    if (response.status === 429) {
      const delay = retryAfterDelay(response.headers.get("retry-after"), nowImpl())
        ?? Math.min(5_000 * (2 ** rateLimitRetries), MAX_RETRY_DELAY_MS);
      await response.body?.cancel();
      if (delay > MAX_RETRY_DELAY_MS) throw new Error(`model_retry_after_exceeds_limit:${file.path}:429`);
      if (rateLimitRetries === MAX_RATE_LIMIT_RETRIES) throw new Error(`model_download_http_429:${file.path}`);
      rateLimitRetries++;
      await waitImpl(delay, signal);
      signal?.throwIfAborted();
      continue;
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`model_download_http_${response.status}`);
    }
    return response;
  }
}

async function downloadFile(directory, file, fetchImpl, signal, waitImpl, nowImpl) {
  const destination = join(directory, file.path);
  await mkdir(dirname(destination), { recursive: true });
  const temporary = await mkdtemp(join(dirname(destination), ".model-download-"));
  try {
    const response = await fetchModelFile(file, fetchImpl, signal, waitImpl, nowImpl);
    const length = response.headers.get("content-length");
    if (length && !response.headers.get("content-encoding") && Number(length) !== file.size) {
      await response.body.cancel();
      throw new Error(`model_size_mismatch:${file.path}`);
    }
    const hash = fileHash(file);
    const sha256 = file.algorithm === "sha256" ? hash : createHash("sha256");
    let bytes = 0;
    const verifier = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        if (bytes > file.size) return callback(new Error(`model_size_exceeded:${file.path}`));
        hash.update(chunk);
        if (sha256 !== hash) sha256.update(chunk);
        callback(null, chunk);
      },
    });
    const stagedFile = join(temporary, "asset");
    await pipeline(Readable.fromWeb(response.body), verifier,
      createWriteStream(stagedFile, { flags: "wx" }), { signal });
    if (bytes !== file.size) throw new Error(`model_size_mismatch:${file.path}`);
    const digest = hash.digest("hex");
    if (digest !== file.digest) throw new Error(`model_digest_mismatch:${file.path}`);
    // Same filesystem rename: a failed transfer never replaces an existing file.
    await rename(stagedFile, destination);
    return { bytes, sha256: sha256 === hash ? digest : sha256.digest("hex") };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function modelManifest(files) {
  return { model: MODEL_ID, revision: MODEL_REVISION, dtype: "fp32", dimensions: 384,
    files: files.map(({ path, sha256, bytes }) => ({ path, sha256, bytes })) };
}

async function verifyManifest(directory, results) {
  try {
    const path = join(directory, "manifest.json");
    const stat = await lstat(path);
    if (!stat.isFile() || stat.size > 16384) return "invalid";
    const actual = JSON.parse(await readFile(path, "utf8"));
    return results.every((file) => file.status === "valid")
      && JSON.stringify(actual) === JSON.stringify(modelManifest(results)) ? "valid" : "invalid";
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    if (error instanceof SyntaxError) return "invalid";
    throw error;
  }
}

async function writeManifest(directory, results) {
  const temporary = await mkdtemp(join(directory, ".model-manifest-"));
  try {
    const stagedFile = join(temporary, "manifest.json");
    await writeFile(stagedFile, `${JSON.stringify(modelManifest(results), null, 2)}\n`, { flag: "wx" });
    await rename(stagedFile, join(directory, "manifest.json"));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function checkModel({ directory = DEFAULT_MODEL_DIRECTORY, files = MODEL_FILES } = {}) {
  const results = [];
  for (const file of files) results.push({ path: file.path, ...await verifyFile(directory, file) });
  return { model: MODEL_ID, revision: MODEL_REVISION, directory: resolve(directory), files: results,
    manifest: { path: "manifest.json", status: await verifyManifest(directory, results) } };
}

export async function prepareModel({ directory = DEFAULT_MODEL_DIRECTORY, files = MODEL_FILES,
  fetchImpl = globalThis.fetch, signal, waitImpl = abortableWait, nowImpl = Date.now } = {}) {
  // Validate all destinations before making any network request or filesystem mutation.
  files.forEach(validateFile);
  const results = [];
  for (const file of files) {
    signal?.throwIfAborted();
    const verified = await verifyFile(directory, file);
    if (verified.status === "valid") {
      results.push({ ...verified, path: file.path, status: "reused" });
      continue;
    }
    const timeout = AbortSignal.timeout(15 * 60 * 1000);
    const downloaded = await downloadFile(directory, file, fetchImpl,
      signal ? AbortSignal.any([signal, timeout]) : timeout, waitImpl, nowImpl);
    results.push({ ...downloaded, path: file.path, status: "downloaded" });
  }
  await mkdir(directory, { recursive: true });
  await writeManifest(directory, results);
  return { model: MODEL_ID, revision: MODEL_REVISION, directory: resolve(directory), files: results,
    manifest: { path: "manifest.json", status: "written" } };
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes("--help")) {
    console.log("Usage: node scripts/prepare-meme-embedding-model.mjs [--check] [--dir PATH] [--if-enabled]\n"
      + "Prepare verified FP32 assets before building. --check performs local verification only.\n"
      + "--if-enabled skips preparation unless MEME_EMBEDDING_RUNTIME=bundled.\n"
      + `Default directory: ${DEFAULT_MODEL_DIRECTORY}\nNo tokens, paid APIs, DB writes, or runtime downloads are used.`);
    return;
  }
  let directory = DEFAULT_MODEL_DIRECTORY;
  let check = false;
  let ifEnabled = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--check") check = true;
    else if (args[index] === "--if-enabled") ifEnabled = true;
    else if (args[index] === "--dir" && args[index + 1] && !args[index + 1].startsWith("--")) directory = resolve(args[++index]);
    else throw new Error(`unknown_or_incomplete_argument:${args[index]}`);
  }
  if (ifEnabled && process.env.MEME_EMBEDDING_RUNTIME !== "bundled") return;
  const controller = new AbortController();
  const abort = () => controller.abort(new Error("model_download_interrupted"));
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    const result = check ? await checkModel({ directory }) : await prepareModel({ directory, signal: controller.signal });
    console.log(JSON.stringify(result, null, 2));
    if (check && (result.files.some((file) => file.status !== "valid") || result.manifest.status !== "valid")) process.exitCode = 1;
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
