import { isRenderableContent, UNAVAILABLE_STATUSES } from "@/lib/content-availability";
import { normalizeSourceUrl, isYouTubePlatform } from "@/lib/sources/url";
import { sourcePlatformFromReference } from "@/lib/source-platform";
import {
  preferredSourceUrl,
  sourceLinksWithContent,
  type SourceLink,
} from "@/lib/source-links";

type DeliveryContent = {
  readonly id?: string;
  readonly meme_id?: string;
  readonly url?: string | null;
  readonly platform?: string | null;
  readonly content_id?: string | null;
  readonly availability?: string | null;
  readonly moderation_status?: string | null;
  readonly is_representative?: boolean | null;
  /** Produced explainers are rendered in their own section, never as original media. */
  readonly production_id?: string | null;
};

type SecondaryReferenceSource = SourceLink & {
  readonly meme_id?: string;
  readonly source_role?: string | null;
  readonly rights_basis?: string | null;
};

type DeliveryInput<T extends DeliveryContent, S extends SourceLink> = {
  readonly contents: readonly T[];
  readonly sources: readonly S[];
};

export type MemeDelivery<T extends DeliveryContent, S extends SourceLink = SourceLink> = {
  readonly representative: T | null;
  readonly renderableContents: readonly T[];
  /** Stored evidence only, with unavailable aliases removed; no media URL inflation. */
  readonly originalSources: readonly S[];
  readonly fallbackSourceUrl: string | null;
  readonly sourceLinks: readonly SourceLink[];
  readonly fallbackReason: "confirmed_unavailable" | "no_playback_reference" | null;
};

const unavailableStatuses = new Set<string>(UNAVAILABLE_STATUSES);

function normalizedUrl(url?: string | null): string | null {
  const value = url?.trim() ?? "";
  return value ? value : null;
}

function urlKey(url?: string | null): string | null {
  const value = normalizedUrl(url);
  if (!value) return null;
  try {
    const source = normalizeSourceUrl(value);
    if (source) {
      // One platform resource can have watch/shorts/share/embed URL variants.
      // Preserve ID case; YouTube Shorts and regular URLs share the same ID space.
      return `${isYouTubePlatform(source.platform) ? "youtube" : source.platform}:${source.externalId}`;
    }
    return new URL(value).href;
  } catch {
    return value;
  }
}

function youtubeContentKey(content: DeliveryContent): string | null {
  const platform = sourcePlatformFromReference({ platform: content.platform, url: content.url });
  if (platform !== "youtube" && platform !== "youtube_shorts") return null;
  const contentId = content.content_id?.trim() ?? "";
  const url = normalizedUrl(content.url);
  if (!contentId || !url) return null;
  const parsed = normalizeSourceUrl(url);
  if (!parsed || !isYouTubePlatform(parsed.platform) || parsed.externalId !== contentId) return null;
  return `youtube:${contentId}`;
}

function approvedSecondaryReferenceKeys(
  sources: readonly SecondaryReferenceSource[],
  memeId?: string,
): Set<string> {
  return new Set(sources.flatMap((source) => {
    if (source.source_role !== "secondary_reference" || source.rights_basis !== "official_embed") return [];
    if (memeId !== undefined && source.meme_id !== memeId) return [];
    const parsed = normalizeSourceUrl(source.source_url?.trim() ?? "");
    if (!parsed || !isYouTubePlatform(parsed.platform)) return [];
    return [`youtube:${parsed.externalId}`];
  }));
}

function isApprovedSecondaryReference(
  content: DeliveryContent,
  sources: readonly SecondaryReferenceSource[],
): boolean {
  const key = youtubeContentKey(content);
  const memeId = content.meme_id?.trim();
  if (!key || !memeId) return false;
  return approvedSecondaryReferenceKeys(sources, memeId).has(key);
}

export function selectSecondaryReferenceContents<
  T extends DeliveryContent,
  S extends SecondaryReferenceSource,
>({
  memeId,
  contents,
  sources,
  representative,
  limit = 2,
}: {
  readonly memeId: string;
  readonly contents: readonly T[];
  readonly sources: readonly S[];
  readonly representative: T | null;
  readonly limit?: number;
}): T[] {
  const approvedKeys = approvedSecondaryReferenceKeys(sources, memeId);
  const representativeKey = representative ? youtubeContentKey(representative) : null;
  const maximum = Number.isFinite(limit)
    ? Math.min(2, Math.max(0, Math.floor(limit)))
    : 0;
  if (maximum === 0) return [];
  const seen = new Set<string>();
  const selected: T[] = [];

  for (const content of contents) {
    const key = youtubeContentKey(content);
    if (
      !key ||
      content.meme_id !== memeId ||
      content.availability !== "live" ||
      content.moderation_status !== "approved" ||
      content === representative ||
      (content.id && content.id === representative?.id) ||
      key === representativeKey ||
      !approvedKeys.has(key) ||
      seen.has(key)
    ) continue;
    seen.add(key);
    selected.push(content);
    if (selected.length >= maximum) break;
  }
  return selected;
}

function isUnavailable(content: DeliveryContent): boolean {
  return content.availability != null && unavailableStatuses.has(content.availability);
}

export function resolveMemeDelivery<T extends DeliveryContent, S extends SourceLink>({
  contents,
  sources,
}: DeliveryInput<T, S>): MemeDelivery<T, S> {
  const originalContents = contents.filter((content) => !content.production_id);
  const originalSources = sources.filter((source) => !source.production_id);
  const unavailableUrls = new Set(
    originalContents
      .filter(isUnavailable)
      .map((content) => urlKey(content.url))
      .filter((url): url is string => url !== null),
  );
  const renderableContents = originalContents.filter(
    (content) => isRenderableContent(content) && !unavailableUrls.has(urlKey(content.url) ?? ""),
  );
  const secondaryReferenceKeys = new Set(originalContents.flatMap((content) => {
    const key = youtubeContentKey(content);
    return key && isApprovedSecondaryReference(content, originalSources) ? [key] : [];
  }));
  const representativeContents = renderableContents.filter(
    (content) => !isApprovedSecondaryReference(content, originalSources),
  );
  const representative =
    representativeContents.find((content) => content.is_representative) ??
    representativeContents[0] ??
    null;
  const safeOriginalSources = originalSources.filter((source) => {
    const url = normalizedUrl(source.source_url);
    return url !== null && !unavailableUrls.has(urlKey(url) ?? "");
  });
  const sourceLinks = sourceLinksWithContent([...safeOriginalSources], renderableContents);
  const safeSources = sourceLinks.filter((source) => {
    const url = normalizedUrl(source.source_url);
    return url !== null && !unavailableUrls.has(urlKey(url) ?? "");
  });
  const primaryFallbackSources = safeSources.filter((source) => {
    const key = urlKey(source.source_url);
    return key === null || !secondaryReferenceKeys.has(key);
  });

  return {
    representative,
    renderableContents,
    originalSources: safeOriginalSources,
    fallbackSourceUrl: preferredSourceUrl(primaryFallbackSources),
    sourceLinks: safeSources,
    fallbackReason:
      representative === null
        ? originalContents.some(isUnavailable)
          ? "confirmed_unavailable"
          : "no_playback_reference"
        : null,
  };
}
