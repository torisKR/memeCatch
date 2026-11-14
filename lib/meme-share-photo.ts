import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { isRenderableContent } from "@/lib/content-availability";
import { ownedMemeCardArtPath } from "@/lib/meme-card-art";
import { resolveMemeDelivery } from "@/lib/meme-delivery";
import type { ShareTimestamp } from "@/lib/share-version";
import { SITE_URL } from "@/lib/site";

/** Shorter side below this is too small to fill a 1200×630 card. */
export const MIN_SHARE_PHOTO_SIDE = 400;
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

/** PNG or JPEG large enough for the card. WebP and other formats are skipped. */
export function prepareSharePhoto(bytes: Uint8Array): PreparedSharePhoto | null {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_SHARE_PHOTO_BYTES) return null;
  const size = imageSize(bytes);
  if (!size) return null;
  if (Math.min(size.width, size.height) < MIN_SHARE_PHOTO_SIDE) return null;
  const encoded = Buffer.from(bytes).toString("base64");
  return {
    dataUrl: `data:${size.mime};base64,${encoded}`,
    width: size.width,
    height: size.height,
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
