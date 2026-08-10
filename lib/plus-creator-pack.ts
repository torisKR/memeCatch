import {
  LIFECYCLE_STATUS,
  SAFETY_LEVELS,
  type LifecycleStatus,
  type SafetyLevel,
} from "@/lib/labels";
import {
  buildPlusDailySharePack,
  type PlusDailySharePackLocale,
} from "@/lib/plus-daily-share-pack";
import type { PlusGlobalActionInboxItem } from "@/lib/plus-global-action-inbox";
import type { PlusOutcomeChannel } from "@/lib/plus-outcome-ledger";

export const PLUS_CREATOR_PACK_LIMIT = 5;

export type PlusCreatorPackFormat = "card" | "story";

const STORY_CHANNELS = new Set<PlusOutcomeChannel>(["instagram", "tiktok", "youtube"]);

export function creatorPackFormatForChannel(channel: PlusOutcomeChannel): PlusCreatorPackFormat {
  return STORY_CHANNELS.has(channel) ? "story" : "card";
}

export type PlusCreatorPackItem = {
  actionId: string;
  memeId: string;
  shortId: string;
  title: string;
  locale: PlusDailySharePackLocale;
  detailPath: string;
  exportPath: string;
  shareText: string;
  filename: string;
};

export type PlusCreatorPack = {
  status: "ready" | "empty";
  items: PlusCreatorPackItem[];
  shareText: string;
  skippedCount: number;
};

function isPackLocale(value: string): value is PlusDailySharePackLocale {
  return value === "ko" || value === "en" || value === "ja" || value === "zh" || value === "zh-tw";
}

function isSafetyLevel(value: unknown): value is SafetyLevel {
  return typeof value === "string" && Object.hasOwn(SAFETY_LEVELS, value);
}

function isLifecycleStatus(value: unknown): value is LifecycleStatus {
  return typeof value === "string" && Object.hasOwn(LIFECYCLE_STATUS, value);
}

function safeFilename(shortId: string): string {
  const safeId = shortId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "meme";
  return `memecatch-${safeId}-creator.png`;
}

function packLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return PLUS_CREATOR_PACK_LIMIT;
  return Math.min(PLUS_CREATOR_PACK_LIMIT, Math.max(0, Math.trunc(limit)));
}

function isReadyItem(item: PlusGlobalActionInboxItem): boolean {
  const facts = item.creatorPackFacts;
  return Boolean(
    isPackLocale(item.locale) &&
      item.shortId.trim() &&
      item.slug?.trim() &&
      item.href.trim() &&
      facts &&
      facts.title.trim() &&
      facts.summary.trim() &&
      isSafetyLevel(facts.safetyLevel) &&
      isLifecycleStatus(facts.lifecycleStatus),
  );
}

export function buildPlusCreatorPack({
  items,
  limit,
  usageExampleIndexes,
  channel,
}: {
  items: readonly PlusGlobalActionInboxItem[];
  limit?: number;
  usageExampleIndexes?: Readonly<Record<string, number | null>>;
  channel?: PlusOutcomeChannel;
}): PlusCreatorPack {
  const candidates = items.slice(0, packLimit(limit));
  const packed = candidates.flatMap((item): PlusCreatorPackItem[] => {
    if (!isReadyItem(item) || !item.slug || !item.creatorPackFacts) return [];
    const facts = item.creatorPackFacts;
    const usageExampleIndex = usageExampleIndexes?.[item.memeId] ?? null;
    const usageExample =
      typeof usageExampleIndex === "number" && usageExampleIndex >= 0
        ? facts.usageExamples?.[usageExampleIndex] ?? null
        : null;
    const base = buildPlusDailySharePack({
      locale: item.locale as PlusDailySharePackLocale,
      shortId: item.shortId,
      slug: item.slug,
      facts,
      usageExample,
      channel,
    });
    const shareText = base.shareText.replace(base.detailPath, item.href);
    return [{
      actionId: item.id,
      memeId: item.memeId,
      shortId: item.shortId,
      title: facts.title,
      locale: item.locale as PlusDailySharePackLocale,
      detailPath: item.href,
      exportPath: base.exportPath,
      shareText,
      filename: safeFilename(item.shortId),
    }];
  });

  return {
    status: packed.length > 0 ? "ready" : "empty",
    items: packed,
    shareText: packed.map((item) => item.shareText).join("\n\n---\n\n"),
    skippedCount: candidates.length - packed.length,
  };
}
