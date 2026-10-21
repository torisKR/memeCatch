const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/u;
const CONTROL_TEXT = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

/** The player URL is shared by the visible iframe and its structured data. */
export function producedVideoEmbedUrl(videoId) {
  return typeof videoId === "string" && VIDEO_ID.test(videoId)
    ? `https://www.youtube-nocookie.com/embed/${videoId}` : null;
}

function publishedTimestamp(value, now) {
  if (typeof value !== "string" || !Number.isFinite(now)) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/u.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1
      || calendar.getUTCDate() !== day) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= now ? value : null;
}

function videoThumbnail(value, videoId) {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "i.ytimg.com" || url.port
        || url.username || url.password || url.search || url.hash) return null;
    if (!new RegExp(`^/(?:vi|vi_webp)/${videoId}/[A-Za-z0-9_-]+\\.(?:jpg|webp)$`, "u").test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

/** Syntax guard only: callers must separately require persisted public playback proof. */
export function parseProducedVideoMetadata(value, videoId, now = Date.now()) {
  if (!producedVideoEmbedUrl(videoId) || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const thumbnailUrl = videoThumbnail(value.thumbnailUrl, videoId);
  const uploadDate = publishedTimestamp(value.uploadDate, now);
  if (!name || [...name].length > 100 || CONTROL_TEXT.test(name) || !thumbnailUrl || !uploadDate) return null;
  const description = typeof value.description === "string" && value.description.trim()
    && Buffer.byteLength(value.description, "utf8") <= 5000 && !CONTROL_TEXT.test(value.description)
    ? value.description.trim() : null;
  return Object.freeze({ name, description, thumbnailUrl, uploadDate });
}
