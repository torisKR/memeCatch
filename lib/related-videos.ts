import type { MemeContentRow } from "@/lib/queries";
import { socialVideoPreview } from "@/lib/meme-video-preview";
import { sourcePlatformFromReference } from "@/lib/source-platform";
import { normalizeSourceUrl } from "@/lib/sources/url";

export type RelatedVideoContent = Pick<
  MemeContentRow,
  | "id"
  | "platform"
  | "content_id"
  | "url"
  | "thumbnail_url"
  | "availability"
  | "caption"
  | "moderation_status"
  | "is_representative"
  | "manual_video_verified"
  | "type"
>;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIDEO_MEDIA_TYPES = new Set<RelatedVideoContent["type"]>(["video", "embed"]);

export function relatedVideoIdentity(content: RelatedVideoContent): string | null {
  if (!VIDEO_MEDIA_TYPES.has(content.type) || !content.content_id) return null;

  // ID-only recovery is intentionally limited to reviewed YouTube rows with no
  // stored URL. A present but unsupported, malformed, or mismatched URL must not
  // inherit trust from the free-form platform label.
  const normalized = content.url === null ? null : normalizeSourceUrl(content.url);
  if (content.url !== null && (!normalized || normalized.externalId !== content.content_id)) {
    return null;
  }

  const platform = normalized?.platform ?? sourcePlatformFromReference(content);
  if (
    (platform === "youtube" || platform === "youtube_shorts") &&
    YOUTUBE_ID.test(content.content_id)
  ) {
    return `youtube:${content.content_id}`;
  }

  if (
    (platform === "tiktok" || platform === "instagram") &&
    socialVideoPreview([content]) !== null
  ) {
    return platform === "instagram" && normalized
      ? `instagram:${normalized.canonicalUrl}`
      : `${platform}:${content.content_id}`;
  }

  return null;
}

/**
 * The caller supplies only delivery.embeddableContents, so review, rights,
 * availability, and public-status policy remains centralized in meme-delivery.
 * This layer identifies playable videos and removes duplicate platform media.
 */
export function selectRelatedVideos(
  contents: readonly RelatedVideoContent[],
  representative: RelatedVideoContent | null,
): RelatedVideoContent[] {
  const representativeIdentity = representative
    ? relatedVideoIdentity(representative)
    : null;
  const identities = new Set<string>();

  return contents.filter((content) => {
    if (content.id === representative?.id) return false;
    const identity = relatedVideoIdentity(content);
    if (!identity || identity === representativeIdentity || identities.has(identity)) {
      return false;
    }
    identities.add(identity);
    return true;
  });
}

export function relatedVideoSourceUrl(content: RelatedVideoContent): string | null {
  const normalized = content.url === null ? null : normalizeSourceUrl(content.url);
  if (content.url !== null) {
    return normalized?.externalId === content.content_id ? normalized.canonicalUrl : null;
  }
  const platform = sourcePlatformFromReference(content);
  if (!content.content_id || !YOUTUBE_ID.test(content.content_id)) return null;
  if (platform === "youtube_shorts") {
    return `https://www.youtube.com/shorts/${content.content_id}`;
  }
  if (platform === "youtube") {
    return `https://www.youtube.com/watch?v=${content.content_id}`;
  }
  return null;
}
