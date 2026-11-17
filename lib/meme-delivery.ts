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
  readonly manual_video_verified?: boolean | null;
  readonly type?: string | null;
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

export type ReviewedMediaSourceLookup =
  | { readonly ok: true; readonly sources: readonly ReviewedMediaSource[] }
  | { readonly ok: false; readonly sources: readonly [] };

type DeliveryInput<T extends DeliveryContent, S extends SourceLink> = {
  readonly contents: readonly T[];
  readonly sources: readonly S[];
  readonly reviewedMediaSources?: readonly ReviewedMediaSource[] | ReviewedMediaSourceLookup;
  readonly now?: number;
};

export type MemeDelivery<T extends DeliveryContent, S extends SourceLink> = {
  readonly representative: T | null;
  readonly representativeAmbiguous: boolean;
  readonly renderableContents: T[];
  readonly embeddableContents: T[];
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

function mediaPlatformIdentity(platform: string): string {
  return platform === "youtube_shorts" ? "youtube" : platform;
}

function contentIdentityKey(content: DeliveryContent): string | null {
  const key = urlKey(content.url);
  if (key) return key;
  const platform = sourcePlatformFromReference(content);
  return platform && mediaPlatformIdentity(platform) === "youtube" &&
    content.content_id && /^[A-Za-z0-9_-]{11}$/.test(content.content_id)
    ? `youtube:${content.content_id}` : null;
}

function videoIdentity(content: DeliveryContent): string | null {
  if (content.type != null && content.type !== "video" && content.type !== "embed") return null;
  if (!content.content_id) return null;
  const source = content.url ? normalizeSourceUrl(content.url) : null;
  if (content.url && (!source || source.externalId !== content.content_id)) return null;
  const platform = source?.platform ?? sourcePlatformFromReference(content);
  if (platform === "youtube" || platform === "youtube_shorts") {
    return /^[A-Za-z0-9_-]{11}$/.test(content.content_id) ? `youtube:${content.content_id}` : null;
  }
  if (!source) return null;
  if (source.platform === "instagram") {
    if (source.canonicalUrl.includes("/p/") && content.manual_video_verified !== true) return null;
    return source.canonicalUrl;
  }
  return source.platform === "tiktok" ? `tiktok:${source.externalId}` : null;
}

function selectRepresentative<T extends DeliveryContent>(contents: T[]): { item: T | null; ambiguous: boolean } {
  const representatives = contents.filter((content) => content.is_representative);
  const pool = representatives.length ? representatives : contents;
  const videos = pool.flatMap((content) => {
    const identity = videoIdentity(content);
    return identity ? [{ content, identity }] : [];
  });
  const unknownVideos = pool.filter((content) => {
    if ((content.type !== "video" && content.type !== "embed") || videoIdentity(content)) return false;
    const source = content.url ? normalizeSourceUrl(content.url) : null;
    return !(source?.platform === "instagram" && source.canonicalUrl.includes("/p/") && content.manual_video_verified !== true);
  });
  const identities = new Set(videos.map(({ identity }) => identity));
  if (identities.size > 1 || (unknownVideos.length > 0 && videos.length + unknownVideos.length > 1) || (representatives.length > 1 && videos.length > 0 && videos.length !== representatives.length)) {
    return { item: null, ambiguous: true };
  }
  if (representatives.length) return { item: representatives[0], ambiguous: false };
  return { item: videos[0]?.content ?? contents[0] ?? null, ambiguous: false };
}

function exactReviewedMediaSources(
  content: DeliveryContent,
  reviewedMediaSources: readonly ReviewedMediaSource[],
): ReviewedMediaSource[] {
  const contentUrl = normalizedUrl(content.url);
  if (!content.content_id) return [];
  const normalizedContent = contentUrl ? normalizeSourceUrl(contentUrl) : null;
  const contentPlatform = sourcePlatformFromReference({
    platform: content.platform,
    url: contentUrl,
  });
  if (!contentPlatform || (contentUrl && !normalizedContent) ||
      (normalizedContent && normalizedContent.externalId !== content.content_id) ||
      (!contentUrl && (mediaPlatformIdentity(contentPlatform) !== "youtube" ||
        !/^[A-Za-z0-9_-]{11}$/.test(content.content_id)))) return [];

  return reviewedMediaSources.filter((source) => {
    if (
      mediaPlatformIdentity(source.platform) !== mediaPlatformIdentity(contentPlatform) ||
      source.external_id !== content.content_id
    ) {
      return false;
    }
    const normalizedSource = normalizeSourceUrl(source.canonical_url);
    if (!normalizedSource || normalizedSource.externalId !== source.external_id ||
        mediaPlatformIdentity(normalizedSource.platform) !== mediaPlatformIdentity(source.platform)) return false;
    return mediaPlatformIdentity(source.platform) === "youtube" || source.platform === "tiktok" ||
      normalizedContent?.canonicalUrl === normalizedSource.canonicalUrl;
  });
}

type SourcePolicy = {
  readonly access: "default" | "link_only" | "suppressed";
  readonly confirmedUnavailable: boolean;
};

const explicitNonPublicStatuses = new Set(["private", "unlisted"]);
const validSourcePlatforms = new Set(["youtube", "youtube_shorts", "tiktok", "instagram", "broadcast_archive", "public_archive", "web"]);
const validRights = new Set(["official_embed", "creator_permission", "creative_commons", "public_data", "link_only", "unknown", "blocked"]);
const validReviews = new Set(["pending", "approved", "rejected", "removed"]);
const validPublicStatuses = new Set(["public", "unlisted", "private", "unknown"]);

export function isValidReviewedMediaSource(value: unknown): value is ReviewedMediaSource {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  const nullableString = (item: unknown) => item === null || typeof item === "string";
  return typeof source.platform === "string" && validSourcePlatforms.has(source.platform) &&
    typeof source.review_state === "string" && validReviews.has(source.review_state) &&
    typeof source.rights_basis === "string" && validRights.has(source.rights_basis) &&
    (source.public_status === null || (typeof source.public_status === "string" && validPublicStatuses.has(source.public_status))) &&
    typeof source.canonical_url === "string" && nullableString(source.external_id) &&
    nullableString(source.removed_at) && nullableString(source.last_checked_at) &&
    (source.embeddable === null || typeof source.embeddable === "boolean");
}

function normalizeReviewedMediaSourceLookup(
  value: readonly ReviewedMediaSource[] | ReviewedMediaSourceLookup,
): ReviewedMediaSourceLookup {
  return "ok" in value ? value : { ok: true, sources: value };
}

function policyForReviewedSource(source: ReviewedMediaSource, now: number): SourcePolicy {
  if (
    !isValidReviewedMediaSource(source) ||
    source.review_state !== "approved" ||
    unsafeRights.has(source.rights_basis)
  ) {
    return { access: "suppressed", confirmedUnavailable: false };
  }
  if (source.removed_at || explicitNonPublicStatuses.has(source.public_status ?? "")) {
    return { access: "suppressed", confirmedUnavailable: true };
  }
  if (source.rights_basis === "link_only") {
    return { access: "link_only", confirmedUnavailable: false };
  }
  if (source.embeddable !== false) {
    return { access: "default", confirmedUnavailable: false };
  }
  if (
    (source.platform === "youtube" || source.platform === "youtube_shorts") &&
    source.public_status === "public" &&
    hasFreshStatus(source, now)
  ) {
    return { access: "link_only", confirmedUnavailable: false };
  }
  return { access: "suppressed", confirmedUnavailable: false };
}

function sourcePolicy(
  content: DeliveryContent,
  reviewedMediaSources: readonly ReviewedMediaSource[],
  now: number,
): SourcePolicy {
  if (reviewedMediaSources.some((source) => !isValidReviewedMediaSource(source)) ||
      (content.availability != null && !["live", "dead", "region_blocked", "unchecked"].includes(content.availability))) {
    return { access: "suppressed", confirmedUnavailable: false };
  }
  const normalizedContent = content.url ? normalizeSourceUrl(content.url) : null;
  if (normalizedContent && content.content_id && normalizedContent.externalId !== content.content_id) {
    return { access: "suppressed", confirmedUnavailable: false };
  }
  const platform = sourcePlatformFromReference(content);
  const matching = content.content_id && platform ? reviewedMediaSources.filter((source) => {
    const samePlatform = mediaPlatformIdentity(source.platform) === mediaPlatformIdentity(platform);
    const normalizedSource = normalizeSourceUrl(source.canonical_url);
    const canonicalMatches = normalizedSource && mediaPlatformIdentity(normalizedSource.platform) === mediaPlatformIdentity(platform) && normalizedSource.externalId === content.content_id;
    return (samePlatform && source.external_id === content.content_id) || Boolean(canonicalMatches);
  }) : [];
  const exact = new Set(exactReviewedMediaSources(content, matching));
  const policies = matching.flatMap((source) => {
    const policy = policyForReviewedSource(source, now);
    if (policy.access === "suppressed" || exact.has(source)) return [policy];
    const sourceUrl = normalizeSourceUrl(source.canonical_url);
    if (policy.access === "link_only" && normalizedContent?.platform === "instagram" &&
        sourceUrl?.platform === "instagram" && sourceUrl.externalId === source.external_id &&
        sourceUrl.externalId === content.content_id) return [policy];
    // A valid approval for another Instagram path neither approves nor blocks
    // this path. Legacy content approval remains the existing fallback. A
    // restrictive row above still wins by platform and external ID.
    if (normalizedContent?.platform === "instagram" && sourceUrl?.platform === "instagram" &&
        sourceUrl.externalId === source.external_id && sourceUrl.externalId === content.content_id &&
        sourceUrl.canonicalUrl !== normalizedContent.canonicalUrl) return [];
    return [{ access: "suppressed" as const, confirmedUnavailable: false }];
  });
  if (policies.some((policy) => policy.access === "suppressed")) {
    return {
      access: "suppressed",
      confirmedUnavailable: policies.some((policy) => policy.confirmedUnavailable),
    };
  }
  if (policies.some((policy) => policy.access === "link_only")) {
    return { access: "link_only", confirmedUnavailable: false };
  }
  return { access: "default", confirmedUnavailable: false };
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
  const lookup = normalizeReviewedMediaSourceLookup(reviewedMediaSources);
  const policies = new Map(
    contents.map((content) => [
      content,
      !lookup.ok && (
        normalizedUrl(content.url) ||
        (content.content_id && ["youtube", "youtube_shorts", "instagram", "tiktok"].includes(
          sourcePlatformFromReference(content) ?? "",
        ))
      )
        ? { access: "suppressed" as const, confirmedUnavailable: false }
        : sourcePolicy(content, lookup.sources, now),
    ]),
  );
  const renderableContents = contents.filter(
    (content) =>
      policies.get(content)?.access !== "suppressed" &&
      isRenderableContent(content),
  );
  const selected = selectRepresentative(renderableContents);
  const representative = selected.item;
  const embeddableContents = renderableContents.filter(
    (content) => policies.get(content)?.access === "default",
  );
  const unavailableUrls = new Set(
    contents
      .filter(
        (content) =>
          policies.get(content)?.access === "suppressed" ||
          content.availability === "region_blocked" ||
          (content.availability === "dead" && !renderableContents.includes(content)),
      )
      .map(contentIdentityKey)
      .filter((url): url is string => url !== null),
  );
  const fallbackContents = renderableContents.filter(
    (content) => !unavailableUrls.has(contentIdentityKey(content) ?? ""),
  );
  const linkOnlySources = lookup.ok ? renderableContents.flatMap((content) => {
    if (content.url || policies.get(content)?.access !== "link_only") return [];
    return exactReviewedMediaSources(content, lookup.sources)
      .filter((source) => policyForReviewedSource(source, now).access === "link_only")
      .map((source) => ({ source_url: source.canonical_url, platform: source.platform }));
  }) : [];
  const sourceLinks = (
    lookup.ok ? sourceLinksWithContent([...sources, ...linkOnlySources], fallbackContents) : []
  ).filter((source) => {
    const url = normalizedUrl(source.source_url);
    return url !== null && !unavailableUrls.has(urlKey(url) ?? "");
  });
  const publicSources = (
    lookup.ok ? sourceLinksWithContent([...sources], []) : []
  ).filter((source) => {
    const url = normalizedUrl(source.source_url);
    return url !== null && !unavailableUrls.has(urlKey(url) ?? "");
  }) as S[];

  return {
    representative,
    representativeAmbiguous: selected.ambiguous,
    renderableContents,
    embeddableContents,
    embeddingAllowed: representative == null || policies.get(representative)?.access !== "link_only",
    fallbackSourceUrl: preferredSourceUrl(sourceLinks),
    sourceLinks,
    publicSources,
    fallbackReason:
      representative === null
        ? contents.some(
            (content) => isUnavailable(content) || policies.get(content)?.confirmedUnavailable,
          )
          ? "confirmed_unavailable"
          : "no_playback_reference"
        : null,
  };
}
