import { isRenderableContent } from "@/lib/content-availability";
import { normalizeSourceUrl } from "@/lib/sources/url";

type PreviewContent = {
  url?: string | null;
  content_id?: string | null;
  thumbnail_url?: string | null;
  availability?: string | null;
  moderation_status?: string | null;
  is_representative?: boolean | null;
};

/** Only show a poster whose video is the same one the detail page will play. */
export function youtubeVideoPreview(contents: readonly PreviewContent[] | null | undefined): string | null {
  const renderable = (contents ?? []).filter(isRenderableContent);
  const content = renderable.find((item) => item.is_representative) ?? renderable[0];
  if (!content?.url || !content.content_id) return null;
  const source = normalizeSourceUrl(content.url);
  if (!source || (source.platform !== "youtube" && source.platform !== "youtube_shorts") || source.externalId !== content.content_id) return null;
  return `https://i.ytimg.com/vi/${source.externalId}/hqdefault.jpg`;
}

/** Stored social covers must be explicitly verified and keyed by the post ID. */
export function videoPreview(contents: readonly PreviewContent[] | null | undefined): string | null {
  const youtube = youtubeVideoPreview(contents);
  if (youtube) return youtube;
  const renderable = (contents ?? []).filter(isRenderableContent);
  const content = renderable.find((item) => item.is_representative) ?? renderable[0];
  if (!content?.url || !content.content_id || !content.thumbnail_url) return null;
  const source = normalizeSourceUrl(content.url);
  if (!source || (source.platform !== "instagram" && source.platform !== "tiktok") || source.externalId !== content.content_id) return null;
  const path = `/api/media/meme-thumbs/verified/${source.platform}/${source.externalId}.jpg`;
  if (content.thumbnail_url === path) return path;
  try {
    const image = new URL(content.thumbnail_url);
    if (image.protocol === "https:" && ["catchmeme.com", "www.catchmeme.com"].includes(image.hostname) && !image.username && !image.password && !image.port && image.pathname === path && !image.search && !image.hash) return path;
  } catch {
    return null;
  }
  return null;
}
