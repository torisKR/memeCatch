import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { open } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { publicAttributionUrl } from "../lib/video-production/core.mjs";

const DEFAULT_PORT = 3015;
const HOST = "127.0.0.1";
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;
const MAX_POSTER_BYTES = 32 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/u;

export class LocalReviewError extends Error {
  constructor(code) {
    super(code);
    this.name = "LocalReviewError";
    this.code = code;
  }
}

function fail(code) {
  throw new LocalReviewError(code);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeText(value, fallback, maxLength = 500) {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  return text && text.length <= maxLength && !/[\0\r\n]/u.test(text) ? text : fallback;
}

function safeSourceUrl(value) {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    return publicAttributionUrl(value);
  } catch {
    return null;
  }
}

async function openRegularFile(path, maximumBytes, errorCode) {
  let handle;
  try {
    handle = await open(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size <= 0 || stat.size > maximumBytes) fail(errorCode);
    return { handle, stat };
  } catch (error) {
    await handle?.close().catch(() => {});
    if (error instanceof LocalReviewError) throw error;
    fail(errorCode);
  }
}

async function readBoundedFile(path, maximumBytes, errorCode) {
  const opened = await openRegularFile(path, maximumBytes, errorCode);
  try {
    const bytes = await opened.handle.readFile();
    if (bytes.byteLength !== opened.stat.size) fail(errorCode);
    return bytes;
  } finally {
    await opened.handle.close();
  }
}

async function hashHandle(handle) {
  const hash = createHash("sha256");
  for await (const chunk of handle.createReadStream({ autoClose: false, start: 0 })) hash.update(chunk);
  return hash.digest("hex");
}

function validateManifest(value, videoStat) {
  if (!value || typeof value !== "object" || Array.isArray(value)
      || value.kind !== "real_meme_local_review_candidate") fail("invalid_review_manifest");
  if (!SHA256.test(value.sha256) || !Number.isSafeInteger(value.byteSize) || value.byteSize !== videoStat.size) {
    fail("invalid_video_identity");
  }
  const falseFlags = [
    "assetRightsApproved", "productionApproval", "operatorRightsApproval", "artifactApproval",
    "uploadConsent", "publicationApproval", "publishable",
  ];
  if (value.operatorReviewRequired !== true || falseFlags.some((key) => value[key] !== false)) {
    fail("manifest_not_local_review_candidate");
  }
  return value;
}

function reviewTitle(manifest) {
  return safeText(manifest.title, safeText(manifest.script?.title, "밈캐치 로컬 영상 검수", 200), 200);
}

function sourceList(manifest) {
  if (!Array.isArray(manifest.sources)) return [];
  return manifest.sources.slice(0, 30).flatMap((source) => {
    const url = safeSourceUrl(source?.url);
    if (!url) return [];
    return [{ title: safeText(source?.title, url, 300), url, approved: source?.approved === true }];
  });
}

function statusRow(label, value) {
  return `<dt>${escapeHtml(label)}</dt><dd class="no">${value === false ? "미승인" : "검토 필요"}</dd>`;
}

function renderHtml(manifest) {
  const title = reviewTitle(manifest);
  const sources = sourceList(manifest);
  const technical = manifest.technicalCheck && typeof manifest.technicalCheck === "object" ? manifest.technicalCheck : {};
  const sourceMarkup = sources.length
    ? `<ul>${sources.map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(source.title)}</a>${source.approved ? " <span>검토됨</span>" : ""}</li>`).join("")}</ul>`
    : "<p>표시 가능한 출처 링크가 없습니다.</p>";
  const duration = Number.isInteger(technical.duration_ms) ? `${(technical.duration_ms / 1000).toFixed(2)}초` : "확인 필요";
  const dimensions = Number.isInteger(technical.width) && Number.isInteger(technical.height)
    ? `${technical.width} × ${technical.height}` : "확인 필요";
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · 로컬 검수</title>
<style>body{margin:0;background:#101114;color:#f5f6f8;font-family:system-ui,sans-serif}main{max-width:760px;margin:auto;padding:28px 18px 56px}.notice{padding:14px 16px;border:1px solid #ffb84d;border-radius:12px;background:#2a2114;color:#ffd99c;font-weight:800}video{display:block;width:min(100%,420px);max-height:72vh;margin:24px auto;background:#000;border-radius:18px}h1{font-size:clamp(1.5rem,5vw,2.4rem)}section{margin-top:28px;padding:18px;background:#1a1c21;border-radius:14px}dl{display:grid;grid-template-columns:auto 1fr;gap:10px 20px}dt{color:#adb4c0}dd{margin:0}.no{color:#ff9d9d;font-weight:700}a{color:#8fc7ff;overflow-wrap:anywhere}li+li{margin-top:10px}small{color:#aeb4be}</style></head>
<body><main><p class="notice">로컬 검수용 / 업로드·공개 안 함</p><h1>${escapeHtml(title)}</h1>
<video controls preload="metadata" poster="/poster.png"><source src="/video.mp4" type="video/mp4">영상을 재생할 수 없습니다.</video>
<section><h2>검수 상태</h2><dl>${statusRow("권리 승인", manifest.operatorRightsApproval)}${statusRow("완성본 승인", manifest.artifactApproval)}${statusRow("업로드 동의", manifest.uploadConsent)}${statusRow("공개 승인", manifest.publicationApproval)}${statusRow("발행 가능", manifest.publishable)}</dl></section>
<section><h2>기술 정보</h2><p>${escapeHtml(duration)} · ${escapeHtml(dimensions)} · 기술 검사 ${technical.passed === true ? "통과" : "확인 필요"}</p><small>영상 SHA-256: ${escapeHtml(manifest.sha256)}</small></section>
<section><h2>검토 출처</h2>${sourceMarkup}</section></main></body></html>`;
}

function parseRange(value, size) {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/u.exec(value);
  if (!match || (!match[1] && !match[2])) return false;
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return false;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

function commonHeaders(contentType) {
  return {
    "Cache-Control": "no-store",
    "Content-Type": contentType,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function sameStat(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size && left.mtimeMs === right.mtimeMs;
}

export function parseLocalReviewArgs(argv) {
  if (!Array.isArray(argv)) fail("invalid_cli_arguments");
  const allowed = new Set(["--artifact-dir", "--port"]);
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(flag) || values.has(flag) || typeof value !== "string" || value.startsWith("--")) {
      fail("invalid_cli_arguments");
    }
    values.set(flag, value);
  }
  if (!values.has("--artifact-dir")) fail("artifact_directory_required");
  const portText = values.get("--port") ?? String(DEFAULT_PORT);
  if (!/^\d{1,5}$/u.test(portText)) fail("invalid_port");
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) fail("invalid_port");
  return { artifactDir: resolve(values.get("--artifact-dir")), port };
}

export async function startLocalReviewServer({ artifactDir, port = DEFAULT_PORT }) {
  const requestedDirectory = safeText(artifactDir, "", 4_096);
  if (!requestedDirectory) fail("artifact_directory_required");
  const directory = resolve(requestedDirectory);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) fail("invalid_port");

  const manifestBytes = await readBoundedFile(resolve(directory, "review-candidate.json"), MAX_MANIFEST_BYTES, "review_manifest_read_failed");
  let rawManifest;
  try {
    rawManifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    fail("invalid_review_manifest_json");
  }
  const video = await openRegularFile(resolve(directory, "production.mp4"), MAX_VIDEO_BYTES, "video_read_failed");
  let poster;
  try {
    const manifest = validateManifest(rawManifest, video.stat);
    if (await hashHandle(video.handle) !== manifest.sha256) fail("video_sha256_mismatch");
    poster = await readBoundedFile(resolve(directory, "poster.png"), MAX_POSTER_BYTES, "poster_read_failed");
    const html = Buffer.from(renderHtml(manifest), "utf8");

    const server = createServer(async (request, response) => {
      try {
        if (request.method !== "GET" && request.method !== "HEAD") {
          response.writeHead(405, { ...commonHeaders("text/plain; charset=utf-8"), Allow: "GET, HEAD" });
          response.end("Method Not Allowed");
          return;
        }
        let parsed;
        try {
          parsed = new URL(request.url ?? "", `http://${HOST}`);
        } catch {
          response.writeHead(400, commonHeaders("text/plain; charset=utf-8"));
          response.end("Bad Request");
          return;
        }
        if (parsed.search || parsed.pathname.includes("..")) {
          response.writeHead(404, commonHeaders("text/plain; charset=utf-8"));
          response.end("Not Found");
          return;
        }
        if (parsed.pathname === "/") {
          response.writeHead(200, { ...commonHeaders("text/html; charset=utf-8"),
            "Content-Length": html.byteLength,
            "Content-Security-Policy": "default-src 'none'; media-src 'self'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" });
          response.end(request.method === "HEAD" ? undefined : html);
          return;
        }
        if (parsed.pathname === "/poster.png") {
          response.writeHead(200, { ...commonHeaders("image/png"), "Content-Length": poster.byteLength });
          response.end(request.method === "HEAD" ? undefined : poster);
          return;
        }
        if (parsed.pathname !== "/video.mp4") {
          response.writeHead(404, commonHeaders("text/plain; charset=utf-8"));
          response.end("Not Found");
          return;
        }
        const currentStat = await video.handle.stat();
        if (!sameStat(video.stat, currentStat)) {
          response.writeHead(409, commonHeaders("text/plain; charset=utf-8"));
          response.end("Artifact changed; restart review server");
          return;
        }
        const range = parseRange(request.headers.range, video.stat.size);
        if (range === false) {
          response.writeHead(416, { ...commonHeaders("text/plain; charset=utf-8"),
            "Accept-Ranges": "bytes", "Content-Range": `bytes */${video.stat.size}` });
          response.end("Range Not Satisfiable");
          return;
        }
        const start = range?.start ?? 0;
        const end = range?.end ?? video.stat.size - 1;
        response.writeHead(range ? 206 : 200, { ...commonHeaders("video/mp4"), "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1, ...(range ? { "Content-Range": `bytes ${start}-${end}/${video.stat.size}` } : {}) });
        if (request.method === "HEAD") response.end();
        else {
          const stream = video.handle.createReadStream({ autoClose: false, start, end });
          stream.once("error", () => response.destroy());
          stream.pipe(response);
        }
      } catch {
        if (!response.headersSent) response.writeHead(500, commonHeaders("text/plain; charset=utf-8"));
        response.end("Local review server error");
      }
    });

    await new Promise((resolveListen, rejectListen) => {
      const onError = (error) => rejectListen(error);
      server.once("error", onError);
      server.listen({ host: HOST, port, exclusive: true }, () => {
        server.off("error", onError);
        resolveListen();
      });
    }).catch(async (error) => {
      server.close();
      fail(error?.code === "EADDRINUSE" ? "review_port_in_use" : "review_server_start_failed");
    });
    const address = server.address();
    const close = async () => {
      await new Promise((resolveClose) => server.close(() => resolveClose()));
      await video.handle.close().catch(() => {});
    };
    return { server, close, url: `http://${HOST}:${address.port}/`, manifest };
  } catch (error) {
    await video.handle.close().catch(() => {});
    throw error;
  }
}

async function main() {
  const options = parseLocalReviewArgs(process.argv.slice(2));
  const review = await startLocalReviewServer(options);
  process.stdout.write(`${JSON.stringify({ url: review.url, artifactDir: options.artifactDir,
    mode: "local_review_only", upload: false, publication: false })}\n`);
  const stop = async () => {
    await review.close();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const code = error instanceof LocalReviewError ? error.code : "local_review_failed";
    process.stderr.write(`${JSON.stringify({ error: code })}\n`);
    process.exitCode = 1;
  });
}
