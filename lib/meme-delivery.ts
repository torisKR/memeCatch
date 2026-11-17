import { isRenderableContent, UNAVAILABLE_STATUSES } from "@/lib/content-availability";
import { sourcePlatformFromReference } from "@/lib/source-platform";
import {
  preferredSourceUrl,
  sourceLinksWithContent,
  type SourceLink,
} from "@/lib/source-links";
import { normalizeSourceUrl } from "@/lib/sources/url";

type DeliveryContent = {
  readonly id?: string;
  readonly platform?: string | null;
  readonly content_id?: string | null;
  readonly url?: string | null;
  readonly availability?: string | null;
  readonly moderation_status?: string | null;
  readonly is_representative?: boolean | null;
};

export type ReviewedMediaSource = {
  readonly review_state: string;
  readonly rights_basis: string;
  readonly platform: string;
  readonly external_id: string | null;
  readonly canonical_url: string;
  readonly embeddable: boolean | null;
  readonly public_status: string | null;
  readonly removed_at: string | null;
  readonly last_checked_at: string | null;
};

type DeliveryInput<T extends DeliveryContent, S extends SourceLink> = {
  readonly contents: readonly T[];
  readonly sources: readonly S[];
  readonly reviewedMediaSources?: readonly ReviewedMediaSource[];
  readonly now?: number;
};

export type MemeDelivery<T extends DeliveryContent, S extends SourceLink> = {
  readonly representative: T | null;
  readonly embeddingAllowed: boolean;
  readonly fallbackSourceUrl: string | null;
  readonly sourceLinks: SourceLink[];
  readonly publicSources: S[];
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
  const social = normalizeSourceUrl(value);
  if (social) {
    const platform = social.platform === "youtube_shorts" ? "youtube" : social.platform;
    return `${platform}:${social.externalId}`;
  }
  try {
    return new URL(value).href;
  } catch {
    return value;
  }
}

function isUnavailable(content: DeliveryContent): boolean {
  return content.availability != null && unavailableStatuses.has(content.availability);
}

const unsafeRights = new Set(["unknown", "blocked"]);
const SOURCE_STATUS_MAX_AGE_MS = 86_400_000;

function hasFreshStatus(source: ReviewedMediaSource, now: number): boolean {
  if (!source.last_checked_at) return false;
  const checkedAt = Date.parse(source.last_checked_at);
  return Number.isFinite(checkedAt) && checkedAt <= now && now - checkedAt <= SOURCE_STATUS_MAX_AGE_MS;
}

function exactReviewedMediaSource(
  content: DeliveryContent,
  reviewedMediaSources: readonly ReviewedMediaSource[],
): ReviewedMediaSource | null {
  const contentUrl = normalizedUrl(content.url);
  if (!contentUrl || !content.content_id) return null;
  const normalizedContent = normalizeSourceUrl(contentUrl);
  const contentPlatform = sourcePlatformFromReference({
    platform: content.platform,
    url: contentUrl,
  });
  if (!normalizedContent || !contentPlatform) return null;

  const matches = reviewedMediaSources.filter((source) => {
    if (
      source.review_state !== "approved" ||
      unsafeRights.has(source.rights_basis) ||
      source.platform !== contentPlatform ||
      source.external_id !== content.content_id
    ) {
      return false;
    }
    const normalizedSource = normalizeSourceUrl(source.canonical_url);
    return normalizedSource?.platform === source.platform &&
      normalizedSource.externalId === source.external_id &&
      normalizedContent.canonicalUrl === normalizedSource.canonicalUrl;
  });
  return matches.reduce<ReviewedMediaSource | null>((latest, candidate) => {
    if (!latest) return candidate;
    const latestTime = Date.parse(latest.last_checked_at ?? "");
    const candidateTime = Date.parse(candidate.last_checked_at ?? "");
    if (Number.isFinite(candidateTime) && (!Number.isFinite(latestTime) || candidateTime > latestTime)) {
      return candidate;
    }
    if (
      candidateTime === latestTime &&
      (candidate.removed_at != null || candidate.public_status !== "public") &&
      latest.removed_at == null &&
      latest.public_status === "public"
    ) {
      return candidate;
    }
    return latest;
  }, null);
}

function sourcePolicy(
  content: DeliveryContent,
  reviewedMediaSources: readonly ReviewedMediaSource[],
  now: number,
): "default" | "link_only" | "suppressed" {
  const source = exactReviewedMediaSource(content, reviewedMediaSources);
  if (!source) return "default";
  if (source.removed_at || (source.public_status != null && source.public_status !== "public")) {
    return "suppressed";
  }
  if (source.embeddable !== false) return "default";
  return (source.platform === "youtube" || source.platform === "youtube_shorts") &&
    source.public_status === "public" &&
    hasFreshStatus(source, now)
    ? "link_only"
    : "suppressed";
}

export function resolveMemeDelivery<
  T extends DeliveryContent,
  S extends SourceLink,
>({
  contents,
  sources,
  reviewedMediaSources = [],
  now = Date.now(),
}: DeliveryInput<T, S>): MemeDelivery<T, S> {
  const policies = new Map(
    contents.map((content) => [content, sourcePolicy(content, reviewedMediaSources, now)]),
  );
  const renderableContents = contents.filter(
    (content) =>
      policies.get(content) !== "suppressed" &&
      (isRenderableContent(content) ||
        (policies.get(content) === "link_only" &&
          content.moderation_status === "approved" &&
          content.availability === "dead")),
  );
  const representative =
    renderableContents.find((content) => content.is_representative) ??
    renderableContents[0] ??
    null;
  const unavailableUrls = new Set(
    contents
      .filter(
        (content) =>
          policies.get(content) === "suppressed" ||
          content.availability === "region_blocked" ||
          (content.availability === "dead" && policies.get(content) !== "link_only"),
      )
      .map((content) => urlKey(content.url))
      .filter((url): url is string => url !== null),
  );
  const fallbackContents = renderableContents.filter(
    (content) => !unavailableUrls.has(urlKey(content.url) ?? ""),
  );
  const sourceLinks = sourceLinksWithContent([...sources], fallbackContents).filter((source) => {
    const url = normalizedUrl(source.source_url);
    return url !== null && !unavailableUrls.has(urlKey(url) ?? "");
  });
  const publicSources = sourceLinksWithContent([...sources], []).filter((source) => {
    const url = normalizedUrl(source.source_url);
    return url !== null && !unavailableUrls.has(urlKey(url) ?? "");
  }) as S[];

  return {
    representative,
    embeddingAllowed: representative == null || policies.get(representative) !== "link_only",
    fallbackSourceUrl: preferredSourceUrl(sourceLinks),
    sourceLinks,
    publicSources,
    fallbackReason:
      representative === null
        ? contents.some(
            (content) => isUnavailable(content) || policies.get(content) === "suppressed",
          )
          ? "confirmed_unavailable"
          : "no_playback_reference"
        : null,
  };
}
