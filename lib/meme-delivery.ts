import { isRenderableContent, UNAVAILABLE_STATUSES } from "@/lib/content-availability";
import {
  preferredSourceUrl,
  sourceLinksWithContent,
  type SourceLink,
} from "@/lib/source-links";

type DeliveryContent = {
  readonly id?: string;
  readonly url?: string | null;
  readonly availability?: string | null;
  readonly moderation_status?: string | null;
  readonly is_representative?: boolean | null;
};

type DeliveryInput<T extends DeliveryContent> = {
  readonly contents: readonly T[];
  readonly sources: readonly SourceLink[];
};

export type MemeDelivery<T extends DeliveryContent> = {
  readonly representative: T | null;
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
    return new URL(value).href;
  } catch {
    return value;
  }
}

function isUnavailable(content: DeliveryContent): boolean {
  return content.availability != null && unavailableStatuses.has(content.availability);
}

export function resolveMemeDelivery<T extends DeliveryContent>({
  contents,
  sources,
}: DeliveryInput<T>): MemeDelivery<T> {
  const renderableContents = contents.filter(isRenderableContent);
  const representative =
    renderableContents.find((content) => content.is_representative) ??
    renderableContents[0] ??
    null;
  const unavailableUrls = new Set(
    contents
      .filter(isUnavailable)
      .map((content) => urlKey(content.url))
      .filter((url): url is string => url !== null),
  );
  const fallbackContents = renderableContents.filter(
    (content) => !unavailableUrls.has(urlKey(content.url) ?? ""),
  );
  const sourceLinks = sourceLinksWithContent([...sources], fallbackContents);
  const safeSources = sourceLinks.filter((source) => {
    const url = normalizedUrl(source.source_url);
    return url !== null && !unavailableUrls.has(urlKey(url) ?? "");
  });

  return {
    representative,
    fallbackSourceUrl: preferredSourceUrl(safeSources),
    sourceLinks: safeSources,
    fallbackReason:
      representative === null
        ? contents.some(isUnavailable)
          ? "confirmed_unavailable"
          : "no_playback_reference"
        : null,
  };
}
