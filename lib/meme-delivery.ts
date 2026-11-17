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

function normalizeReviewedMediaSourceLookup(
  value: readonly ReviewedMediaSource[] | ReviewedMediaSourceLookup,
): ReviewedMediaSourceLookup {
  return "ok" in value ? value : { ok: true, sources: value };
}

function policyForReviewedSource(source: ReviewedMediaSource, now: number): SourcePolicy {
  if (
    source.review_state !== "approved" ||
    unsafeRights.has(source.rights_basis)
  ) {
    return { access: "suppressed", confirmedUnavailable: false };
  }
  if (source.removed_at || explicitNonPublicStatuses.has(source.public_status ?? "")) {
    return { access: "suppressed", confirmedUnavailable: true };
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
  const normalizedContent = content.url ? normalizeSourceUrl(content.url) : null;
  if (normalizedContent && content.content_id && normalizedContent.externalId !== content.content_id) {
    return { access: "suppressed", confirmedUnavailable: false };
  }
  const policies = exactReviewedMediaSources(content, reviewedMediaSources)
    .map((source) => policyForReviewedSource(source, now));
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
      (isRenderableContent(content) ||
        (policies.get(content)?.access === "link_only" &&
          content.moderation_status === "approved" &&
          content.availability === "dead")),
  );
  const representative =
    renderableContents.find((content) => content.is_representative) ??
    renderableContents[0] ??
    null;
  const embeddableContents = renderableContents.filter(
    (content) => policies.get(content)?.access === "default",
  );
  const unavailableUrls = new Set(
    contents
      .filter(
        (content) =>
          policies.get(content)?.access === "suppressed" ||
          content.availability === "region_blocked" ||
          (content.availability === "dead" && policies.get(content)?.access !== "link_only"),
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
