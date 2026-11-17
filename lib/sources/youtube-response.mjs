const INCONCLUSIVE_ERROR = "youtube_video_list_inconclusive";
const PRIVACY_STATUSES = new Set(["public", "private", "unlisted"]);
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_PLATFORMS = new Set(["youtube", "youtube_shorts"]);

/**
 * Maintenance runners must not let an external ID bypass either the canonical
 * URL identity or an active recovery quarantine.
 *
 * @param {{ id?: unknown, platform?: unknown, external_id?: unknown, canonical_url?: unknown }} source
 * @param {{ platform?: unknown, externalId?: unknown, canonicalUrl?: unknown } | null} normalizedSource
 * @param {ReadonlySet<unknown>} activeQuarantinedSourceIds
 * @returns {"youtube_source_active_quarantine" | "youtube_source_identity_inconclusive" | null}
 */
export function classifyYouTubeMaintenanceSource(
  source,
  normalizedSource,
  activeQuarantinedSourceIds,
) {
  if (activeQuarantinedSourceIds.has(source.id)) {
    return "youtube_source_active_quarantine";
  }
  const platformMatches = normalizedSource && (
    normalizedSource.platform === source.platform ||
    (YOUTUBE_PLATFORMS.has(normalizedSource.platform) && YOUTUBE_PLATFORMS.has(source.platform))
  );
  if (
    typeof source.external_id !== "string" ||
    !YOUTUBE_VIDEO_ID_PATTERN.test(source.external_id) ||
    typeof source.canonical_url !== "string" ||
    !normalizedSource ||
    !platformMatches ||
    normalizedSource.externalId !== source.external_id ||
    normalizedSource.canonicalUrl !== source.canonical_url
  ) {
    return "youtube_source_identity_inconclusive";
  }
  return null;
}

/**
 * @param {Iterable<unknown>} externalIds
 * @returns {Set<string>}
 */
export function validateYouTubeVideoBatchExternalIds(externalIds) {
  const requestedVideoIds = new Set();
  for (const externalId of externalIds) {
    if (typeof externalId !== "string" || externalId.length === 0) {
      throw new Error(INCONCLUSIVE_ERROR);
    }
    requestedVideoIds.add(externalId);
  }
  return requestedVideoIds;
}

/**
 * A videos.list response can only prove omitted videos unavailable when every
 * returned item is well-formed and belongs to the exact request batch.
 *
 * Empty and partial item arrays are valid authoritative responses.
 *
 * @template {{ id?: unknown }} T
 * @param {unknown} response
 * @param {ReadonlySet<string>} requestedVideoIds
 * @returns {Array<T & { id: string }>}
 */
export function validateYouTubeVideosListResponse(response, requestedVideoIds) {
  if (
    !response ||
    typeof response !== "object" ||
    !Array.isArray(response.items)
  ) {
    throw new Error(INCONCLUSIVE_ERROR);
  }

  const seen = new Set();
  for (const item of response.items) {
    if (
      !item ||
      typeof item !== "object" ||
      typeof item.id !== "string" ||
      !requestedVideoIds.has(item.id) ||
      seen.has(item.id)
    ) {
      throw new Error(INCONCLUSIVE_ERROR);
    }
    seen.add(item.id);
  }

  return response.items;
}

/**
 * Status-dependent writes require both fields to be explicit. Missing or
 * unknown values must be retried instead of being persisted as a negative.
 *
 * @template {{ status?: unknown }} T
 * @param {T[]} items
 * @returns {Array<T & { status: { privacyStatus: "public" | "private" | "unlisted", embeddable: boolean } }>}
 */
export function validateYouTubeVideoStatusItems(items) {
  for (const item of items) {
    if (
      !item.status ||
      typeof item.status !== "object" ||
      !PRIVACY_STATUSES.has(item.status.privacyStatus) ||
      typeof item.status.embeddable !== "boolean"
    ) {
      throw new Error(INCONCLUSIVE_ERROR);
    }
  }
  return items;
}

/**
 * Public videos remain reachable as links even when embedding is disabled.
 *
 * @param {{ privacyStatus: "public" | "private" | "unlisted", embeddable: boolean }} status
 * @param {boolean} regionBlocked
 * @returns {"live" | "region_blocked" | "dead"}
 */
export function classifyYouTubeRefreshAvailability(status, regionBlocked) {
  if (status.privacyStatus !== "public") return "dead";
  return regionBlocked ? "region_blocked" : "live";
}

/**
 * Private videos must not retain cached titles or thumbnails. Unlisted videos
 * remain URL-addressable and keep metadata even though catalog projection is
 * dead.
 *
 * @template {Record<string, unknown>} T
 * @param {T} metadata
 * @param {"public" | "private" | "unlisted"} privacyStatus
 * @param {string} now
 * @returns {T & { removed_at: string | null }}
 */
export function applyYouTubePrivateMetadataPolicy(metadata, privacyStatus, now) {
  if (privacyStatus !== "private") {
    return { ...metadata, removed_at: null };
  }
  return {
    ...metadata,
    title: null,
    thumbnail_url: null,
    metadata_expires_at: null,
    removed_at: now,
  };
}
