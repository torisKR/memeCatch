import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { isRenderableContent } from "@/lib/content-availability";
import { decodeBaselineJpeg } from "@/lib/jpeg-decode";
import { ownedMemeCardArtPath } from "@/lib/meme-card-art";
import { resolveMemeDelivery } from "@/lib/meme-delivery";
import { decodePng, encodePng } from "@/lib/png-raster";
import type { ShareTimestamp } from "@/lib/share-version";
import { SITE_URL } from "@/lib/site";

/** Shorter side below this is too small to fill a 1200×630 card. Measured after edge trim. */
export const MIN_SHARE_PHOTO_SIDE = 400;
/** A pixel at or below this luminance (0–255) counts as black. */
export const SHARE_PHOTO_NEAR_BLACK_LUMA = 16;
/** A row or column is a black bar when at least this share of its pixels are black. */
export const SHARE_PHOTO_BLACK_SHARE = 0.98;
/**
 * A black run plus the 2px margin is removed only when that total is at most
 * this fraction of the side. A longer total is left in place.
 */
export const SHARE_PHOTO_EDGE_CAP = 0.35;
/**
 * Source pixels removed past a black bar. Drops the bar/content transition
 * that a downscale can turn into a 98% black edge. Sides with no bar stay put.
 */
export const SHARE_PHOTO_EDGE_MARGIN = 2;
/**
 * A line under 98% black can interrupt a bar when at least this share of its
 * pixels are still luma <= 16. A line below this share ends the scan.
 */
const SHARE_PHOTO_NOISE_SHARE = 0.8;
/** Sub-98% lines allowed in one bar, including a noise line on the outer edge. */
const SHARE_PHOTO_NOISE_LIMIT = 3;
/**
 * Mean of the per-line luma standard deviations, from the outer edge through
 * the last 98% line. Above this the band is a dark scene and the strict run wins.
 */
const SHARE_PHOTO_BAND_STD = 1.5;
/** At this height/width and above, keep the subject near the top of a cover crop. */
export const SHARE_PHOTO_TALL_RATIO = 1.5;

/** Tall portraits use `center 30%`. Square and landscape images stay centered. */
export function sharePhotoObjectPosition(width: number, height: number): "center 30%" | "center center" {
  if (!(width > 0) || !(height > 0)) return "center center";
  return height / width >= SHARE_PHOTO_TALL_RATIO ? "center 30%" : "center center";
}

export const SHARE_PHOTO_TIMEOUT_MS = 1500;
/** Reject a still larger than this before the body is buffered. */
export const MAX_SHARE_PHOTO_BYTES = 8_000_000;
const YOUTUBE_THUMB_HOST = "i.ytimg.com";
const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_THUMB_FILE = /^[A-Za-z0-9_-]+\.jpg$/;
const YOUTUBE_THUMB_LADDER = ["maxresdefault.jpg", "sddefault.jpg", "hqdefault.jpg"] as const;

export type SharePhotoSource = {
  thumbnail_url?: string | null;
  url?: string | null;
  platform?: string | null;
  content_id?: string | null;
  availability?: string | null;
  moderation_status?: string | null;
  is_representative?: boolean | null;
  created_at?: ShareTimestamp | null;
};

export type SharePhotoRef = {
  /** Canonical URL or site path. This string is mixed into `?v`. */
  url: string;
  updatedAt: ShareTimestamp | null;
};

/**
 * The still the detail page already uses for the representative slot:
 * a same-origin editorial image, owned card art, a site-hosted video poster,
 * or the YouTube thumbnail the page already serves (`i.ytimg.com`).
 * The returned URL is the one mixed into `?v`. A larger YouTube variant fetched
 * later is not part of that string.
 */
export function representativeImageUrl(input: {
  contents: readonly SharePhotoSource[];
  sources?: readonly { source_url?: string | null; hidden_from_public?: boolean | null; platform?: string | null }[];
}): SharePhotoRef | null {
  const delivery = resolveMemeDelivery({
    contents: input.contents,
    sources: input.sources ?? [],
  });
  const content = delivery.representative;
  if (!content || !isRenderableContent(content)) return null;
  const thumb = content.thumbnail_url?.trim() || null;
  const hasPlaybackUrl = Boolean(content.url?.trim());
  const owned = !hasPlaybackUrl ? projectOwnedPath(thumb) : null;
  const art = !hasPlaybackUrl ? ownedMemeCardArtPath(thumb) : null;
  // A playback URL means the page shows the player and this thumbnail is its poster.
  const poster = hasPlaybackUrl && thumb
    ? canonicalShareImageUrl(thumb) ?? canonicalYoutubeThumbnailUrl(thumb)
    : null;
  const candidate = owned ?? (art ? `${art}?w=1200` : null) ?? poster;
  if (!candidate) return null;
  return { url: candidate, updatedAt: content.created_at ?? null };
}

function projectOwnedPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("..")) return null;
  const path = value.split(/[?#]/)[0] ?? "";
  if (
    path.includes("hqdefault")
    || path.includes("mqdefault")
    || path.includes("sddefault")
    || path.includes("ytimg")
    || path.startsWith("/api/media/meme-thumbs/")
  ) {
    return null;
  }
  return isAllowedShareImageUrl(path) ? path : null;
}

function siteHosts(): Set<string> {
  const hosts = new Set(["catchmeme.com", "www.catchmeme.com"]);
  for (const raw of [SITE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!raw) continue;
    try {
      hosts.add(new URL(raw).hostname.toLowerCase());
    } catch {
      // Ignore an unparseable configured origin.
    }
  }
  return hosts;
}

function isIpHost(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(":");
}

/** Site origin or the project's own storage host. Rejects arbitrary URLs. */
export function isAllowedShareImageUrl(value: string | null | undefined): boolean {
  return canonicalShareImageUrl(value) != null;
}

export function canonicalShareImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return null;
  if (trimmed.startsWith("/")) {
    if (trimmed.startsWith("//") || trimmed.includes("..") || trimmed.includes("\\")) return null;
    const path = trimmed.split("#")[0] ?? "";
    if (!path.startsWith("/") || path.includes("ytimg")) return null;
    return path;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const hostname = url.hostname.toLowerCase();
  if (isIpHost(hostname) || hostname === "localhost" || hostname.endsWith(".local")) return null;
  if (!siteHosts().has(hostname)) return null;
  if (hostname.endsWith(".supabase.co") && !url.pathname.includes("/storage/")) return null;
  return `${url.origin}${url.pathname}${url.search}`;
}

/**
 * Larger stills of the same YouTube video, then the page's own hqdefault.
 * Null unless the URL is https on `i.ytimg.com` and the video id is 11 characters.
 */
export function youtubeThumbnailCandidates(value: string | null | undefined): readonly string[] | null {
  const videoId = youtubeThumbnailVideoId(value);
  if (!videoId) return null;
  return YOUTUBE_THUMB_LADDER.map((name) => `https://${YOUTUBE_THUMB_HOST}/vi/${videoId}/${name}`);
}

/** The thumbnail URL as recorded. This is the string mixed into `?v`, not a fetched variant. */
export function canonicalYoutubeThumbnailUrl(value: string | null | undefined): string | null {
  if (!youtubeThumbnailVideoId(value) || !value) return null;
  const url = new URL(value.trim());
  return `https://${YOUTUBE_THUMB_HOST}${url.pathname}${url.search}`;
}

function youtubeThumbnailVideoId(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (url.hostname.toLowerCase() !== YOUTUBE_THUMB_HOST) return null;
  const parts = url.pathname.split("/");
  if (parts.length !== 4 || parts[1] !== "vi") return null;
  const videoId = parts[2] ?? "";
  const file = parts[3] ?? "";
  if (!YOUTUBE_VIDEO_ID.test(videoId) || !YOUTUBE_THUMB_FILE.test(file)) return null;
  return videoId;
}

export type PreparedSharePhoto = {
  dataUrl: string;
  width: number;
  height: number;
};

function imageSize(bytes: Uint8Array): { width: number; height: number; mime: "image/png" | "image/jpeg" } | null {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20), mime: "image/png" };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const size = jpegSize(bytes);
    return size ? { ...size, mime: "image/jpeg" } : null;
  }
  return null;
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null;
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const height = ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0);
      const width = ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0);
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

function pixelLuma(red: number, green: number, blue: number): number {
  return 0.299 * red + 0.587 * green + 0.114 * blue;
}

function pixelIsBlack(rgba: Uint8Array, index: number): boolean {
  return pixelLuma(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0) <= SHARE_PHOTO_NEAR_BLACK_LUMA;
}

/** At least 98% of the pixels on this line are at or below the luma cutoff. */
function lineIsBlack(dark: number, length: number): boolean {
  return dark >= length * SHARE_PHOTO_BLACK_SHARE;
}

/** A row is a black bar when at least 98% of its pixels have luminance <= 16. */
export function rowIsNearBlack(rgba: Uint8Array, width: number, y: number): boolean {
  let dark = 0;
  const start = y * width * 4;
  for (let x = 0; x < width; x += 1) {
    if (pixelIsBlack(rgba, start + x * 4)) dark += 1;
  }
  return lineIsBlack(dark, width);
}

/** A column is a black bar when at least 98% of its pixels have luminance <= 16. */
export function columnIsNearBlack(rgba: Uint8Array, width: number, height: number, x: number): boolean {
  let dark = 0;
  for (let y = 0; y < height; y += 1) {
    if (pixelIsBlack(rgba, (y * width + x) * 4)) dark += 1;
  }
  return lineIsBlack(dark, height);
}

function contiguousRun(length: number, isBlack: (offset: number) => boolean): number {
  let run = 0;
  while (run < length && isBlack(run)) run += 1;
  return run;
}

/** How many black rows or columns sit on each edge, before the 35% skip. */
export function blackEdgeRuns(
  rgba: Uint8Array,
  width: number,
  height: number,
): { top: number; bottom: number; left: number; right: number } {
  return {
    top: contiguousRun(height, (offset) => rowIsNearBlack(rgba, width, offset)),
    bottom: contiguousRun(height, (offset) => rowIsNearBlack(rgba, width, height - 1 - offset)),
    left: contiguousRun(width, (offset) => columnIsNearBlack(rgba, width, height, offset)),
    right: contiguousRun(width, (offset) => columnIsNearBlack(rgba, width, height, width - 1 - offset)),
  };
}

/** How many near-black rows sit on each edge, ignoring the trim cap. */
export function nearBlackEdgeRows(rgba: Uint8Array, width: number, height: number): { top: number; bottom: number } {
  const edges = blackEdgeRuns(rgba, width, height);
  return { top: edges.top, bottom: edges.bottom };
}

/** Drop the run plus 2px when that total is within 35% of the side. A longer total stays. */
function trimAmount(run: number, dimension: number): number {
  if (run < 1) return 0;
  const amount = run + SHARE_PHOTO_EDGE_MARGIN;
  if (amount > dimension * SHARE_PHOTO_EDGE_CAP) return 0;
  return amount;
}

type LineStat = { dark: number; lumaStd: number };

function lineStat(rgba: Uint8Array, length: number, indexAt: (offset: number) => number): LineStat {
  let dark = 0;
  let sum = 0;
  let sumSq = 0;
  for (let offset = 0; offset < length; offset += 1) {
    const index = indexAt(offset);
    const luma = pixelLuma(rgba[index] ?? 0, rgba[index + 1] ?? 0, rgba[index + 2] ?? 0);
    sum += luma;
    sumSq += luma * luma;
    if (luma <= SHARE_PHOTO_NEAR_BLACK_LUMA) dark += 1;
  }
  const mean = length > 0 ? sum / length : 0;
  const variance = length > 0 ? sumSq / length - mean * mean : 0;
  return { dark, lumaStd: Math.sqrt(Math.max(0, variance)) };
}

/**
 * Strict bars stay a contiguous 98% run. A longer band may include up to three
 * lines that are under 98% but at least 80% black, then ends on the last 98%
 * line. That band is used only when it trims more, stays within the 35% cap,
 * and its mean per-line luma deviation is at most 1.5. Otherwise the strict
 * amount wins, which is zero when that run is missing or over the cap.
 */
function sideTrim(dimension: number, lineLength: number, statAt: (line: number) => LineStat): number {
  const stats: LineStat[] = [];
  let noise = 0;
  let lastStrict = -1;
  for (let line = 0; line < dimension; line += 1) {
    const stat = statAt(line);
    if (lineIsBlack(stat.dark, lineLength)) {
      stats.push(stat);
      lastStrict = stats.length - 1;
      continue;
    }
    if (stat.dark >= lineLength * SHARE_PHOTO_NOISE_SHARE && noise < SHARE_PHOTO_NOISE_LIMIT) {
      stats.push(stat);
      noise += 1;
      continue;
    }
    break;
  }
  let strictRun = 0;
  while (strictRun < stats.length && lineIsBlack(stats[strictRun]?.dark ?? 0, lineLength)) strictRun += 1;
  const strict = trimAmount(strictRun, dimension);
  if (lastStrict < 0) return strict;
  const band = lastStrict + 1;
  let sumStd = 0;
  for (let line = 0; line < band; line += 1) sumStd += stats[line]?.lumaStd ?? 0;
  if (sumStd / band > SHARE_PHOTO_BAND_STD) return strict;
  const extended = trimAmount(band, dimension);
  return extended > strict ? extended : strict;
}

function rasterOf(bytes: Uint8Array, mime: "image/png" | "image/jpeg"): { width: number; height: number; rgba: Buffer } | null {
  try {
    if (mime === "image/png") return decodePng(Buffer.from(bytes));
    return decodeBaselineJpeg(bytes);
  } catch {
    return null;
  }
}

/**
 * Drop black bars from all four edges before the cover crop.
 * The strict run is contiguous rows or columns where at least 98% of pixels
 * have luminance <= 16. A longer band may absorb up to three noisier lines
 * that are still at least 80% black, including on the outer edge, and must
 * end on a 98% line whose pixels stay uniform. Either way a trimmed side
 * also drops 2 source pixels, and the total is kept only when it is at most
 * 35% of that side. The longer band never replaces a strict trim with a
 * shorter one. Width and height here are the trimmed size: the 400px rule
 * and the tall-photo object-position both use them. No bars leaves the
 * original bytes unchanged.
 */
function trimLetterbox(bytes: Uint8Array, mime: "image/png" | "image/jpeg"): { bytes: Uint8Array; width: number; height: number } | null {
  const size = imageSize(bytes);
  if (!size) return null;
  const raster = rasterOf(bytes, mime);
  if (!raster || raster.width !== size.width || raster.height !== size.height) return null;
  const { rgba, width: rasterWidth, height: rasterHeight } = raster;
  const top = sideTrim(rasterHeight, rasterWidth, (line) => lineStat(rgba, rasterWidth, (x) => ((line * rasterWidth) + x) * 4));
  const bottom = sideTrim(rasterHeight, rasterWidth, (line) => lineStat(
    rgba,
    rasterWidth,
    (x) => (((rasterHeight - 1 - line) * rasterWidth) + x) * 4,
  ));
  const left = sideTrim(rasterWidth, rasterHeight, (line) => lineStat(rgba, rasterHeight, (y) => ((y * rasterWidth) + line) * 4));
  const right = sideTrim(rasterWidth, rasterHeight, (line) => lineStat(
    rgba,
    rasterHeight,
    (y) => ((y * rasterWidth) + (rasterWidth - 1 - line)) * 4,
  ));
  if (top === 0 && bottom === 0 && left === 0 && right === 0) {
    return { bytes, width: raster.width, height: raster.height };
  }
  const width = raster.width - left - right;
  const height = raster.height - top - bottom;
  if (width < 1 || height < 1) return { bytes, width: raster.width, height: raster.height };
  const cropped = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const source = ((y + top) * raster.width + left) * 4;
    raster.rgba.copy(cropped, y * width * 4, source, source + width * 4);
  }
  return { bytes: encodePng(width, height, cropped), width, height };
}

/** PNG or JPEG large enough for the card. WebP and other formats are skipped. */
export function prepareSharePhoto(bytes: Uint8Array): PreparedSharePhoto | null {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SHARE_PHOTO_BYTES) return null;
  const size = imageSize(bytes);
  if (!size) return null;
  const trimmed = trimLetterbox(bytes, size.mime) ?? { bytes, width: size.width, height: size.height };
  if (Math.min(trimmed.width, trimmed.height) < MIN_SHARE_PHOTO_SIDE) return null;
  const mime = trimmed.bytes === bytes ? size.mime : "image/png";
  const encoded = Buffer.from(trimmed.bytes).toString("base64");
  return {
    dataUrl: `data:${mime};base64,${encoded}`,
    width: trimmed.width,
    height: trimmed.height,
  };
}

/** Read a site path from `public/`. A path that leaves that directory is not a file. */
export async function readPublicFile(pathname: string): Promise<Uint8Array | null> {
  const withoutQuery = pathname.split(/[?#]/)[0] ?? "";
  let decoded: string;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    return null;
  }
  const stripped = decoded.replace(/^\/+/, "");
  if (!stripped || stripped.includes("\0")) return null;
  const publicRoot = resolve(process.cwd(), "public");
  const file = resolve(publicRoot, stripped);
  const fromRoot = relative(publicRoot, file);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

/**
 * Fetch a site-hosted still, or a larger YouTube thumbnail of the same video.
 * Failures, timeouts, redirects, tiny images, and formats Satori cannot decode
 * return null so the card stays title-only.
 */
export async function loadSharePhoto(
  url: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = SHARE_PHOTO_TIMEOUT_MS,
): Promise<PreparedSharePhoto | null> {
  const youtube = youtubeThumbnailCandidates(url);
  if (youtube) {
    for (const candidate of youtube) {
      const photo = await fetchPreparedPhoto(candidate, fetchImpl, timeoutMs);
      if (photo) return photo;
    }
    return null;
  }
  const canonical = canonicalShareImageUrl(url);
  if (!canonical) return null;
  try {
    if (canonical.startsWith("/")) {
      const local = await readPublicFile(canonical);
      if (local) return prepareSharePhoto(local);
    }
    const target = canonical.startsWith("/") ? new URL(canonical, SITE_URL) : new URL(canonical);
    return await fetchPreparedPhoto(target, fetchImpl, timeoutMs);
  } catch {
    return null;
  }
}

async function fetchPreparedPhoto(
  target: URL | string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<PreparedSharePhoto | null> {
  try {
    const response = await fetchImpl(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== 200) return null;
    const bytes = await readBoundedBody(response, MAX_SHARE_PHOTO_BYTES);
    if (!bytes) return null;
    return prepareSharePhoto(bytes);
  } catch {
    return null;
  }
}

/** Stop before or during the read when the body exceeds `maxBytes`. */
async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    try {
      await response.body?.cancel();
    } catch {
      // The caller only needs the rejection. A cancel failure is not a photo.
    }
    return null;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength > maxBytes ? null : bytes;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const step = await reader.read();
      if (step.done) break;
      const value = step.value;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The oversized body is already discarded.
        }
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
