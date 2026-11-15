import type { LifecycleStatus, SafetyLevel } from "@/lib/labels";

/** Keep dashboard work bounded even when a Plus library is very large. */
export const SAVED_REUSE_RADAR_CANDIDATE_LIMIT = 60;
export const SAVED_REUSE_RADAR_BUCKET_LIMIT = 3;

export type SavedReuseRadarItem = {
  id: string;
  shortId: string;
  slug: string;
  title: string;
  summary: string;
  safetyLevel: SafetyLevel;
  lifecycleStatus: LifecycleStatus;
  trendScore: number;
  savedAt: string;
  collection: string | null;
};

export type SavedReuseRadar = {
  total: number;
  readyNow: SavedReuseRadarItem[];
  checkContext: SavedReuseRadarItem[];
  archive: SavedReuseRadarItem[];
};

const CURRENT_LIFECYCLES = new Set<LifecycleStatus>(["rising", "active"]);

function toTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function compareByMomentum(
  left: SavedReuseRadarItem,
  right: SavedReuseRadarItem,
): number {
  return (
    right.trendScore - left.trendScore ||
    toTimestamp(right.savedAt) - toTimestamp(left.savedAt) ||
    left.id.localeCompare(right.id)
  );
}

function isCurrent(item: SavedReuseRadarItem): boolean {
  return CURRENT_LIFECYCLES.has(item.lifecycleStatus);
}

/**
 * Converts an unbounded saved library into mutually exclusive actions.
 * Only a green meme that is currently rising/active can be labelled ready;
 * yellow remains a context check and every older/unsafe item stays archival.
 */
export function buildSavedReuseRadar(
  items: readonly SavedReuseRadarItem[],
): SavedReuseRadar {
  const readyNow: SavedReuseRadarItem[] = [];
  const checkContext: SavedReuseRadarItem[] = [];
  const archive: SavedReuseRadarItem[] = [];

  for (const item of items) {
    if (item.safetyLevel === "green" && isCurrent(item)) {
      readyNow.push(item);
    } else if (item.safetyLevel === "yellow" && isCurrent(item)) {
      checkContext.push(item);
    } else {
      archive.push(item);
    }
  }

  return {
    total: items.length,
    readyNow: readyNow.sort(compareByMomentum).slice(0, SAVED_REUSE_RADAR_BUCKET_LIMIT),
    checkContext: checkContext
      .sort(compareByMomentum)
      .slice(0, SAVED_REUSE_RADAR_BUCKET_LIMIT),
    archive: archive.sort(compareByMomentum).slice(0, SAVED_REUSE_RADAR_BUCKET_LIMIT),
  };
}
