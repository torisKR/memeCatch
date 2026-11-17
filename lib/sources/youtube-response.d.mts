export type YouTubeVideosListItem = {
  id: string;
  [key: string]: unknown;
};

export type YouTubeVideoStatusFields = {
  privacyStatus: "public" | "private" | "unlisted";
  embeddable: boolean;
  [key: string]: unknown;
};

export declare function validateYouTubeVideoBatchExternalIds(
  externalIds: Iterable<unknown>,
): Set<string>;

export declare function validateYouTubeVideosListResponse<
  T extends { id?: unknown },
>(
  response: unknown,
  requestedVideoIds: ReadonlySet<string>,
): Array<T & YouTubeVideosListItem>;

export declare function validateYouTubeVideoStatusItems<
  T extends { status?: unknown },
>(items: T[]): Array<T & { status: YouTubeVideoStatusFields }>;

export declare function classifyYouTubeRefreshAvailability(
  status: YouTubeVideoStatusFields,
  regionBlocked: boolean,
): "live" | "region_blocked" | "dead";

export declare function applyYouTubePrivateMetadataPolicy<
  T extends Record<string, unknown>,
>(
  metadata: T,
  privacyStatus: YouTubeVideoStatusFields["privacyStatus"],
  now: string,
): T & {
  removed_at: string | null;
  title?: unknown;
  thumbnail_url?: unknown;
  metadata_expires_at?: unknown;
};
