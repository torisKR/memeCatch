import { isRenderableContent } from "@/lib/content-availability";
import { normalizeSourceUrl } from "@/lib/sources/url";

type PreviewContent = {
  url?: string | null;
  content_id?: string | null;
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
