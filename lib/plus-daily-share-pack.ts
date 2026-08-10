import { localizedMemePath, type SeoRouteLocale } from "@/lib/i18n-routing";
import {
  buildMemeUseKit,
  type MemeUseKitFacts,
  type MemeUseKitLabels,
} from "@/lib/meme-use-kit";
import type { UsageExample } from "@/lib/usage-examples";
import type { PlusOutcomeChannel } from "@/lib/plus-outcome-ledger";

export const PLUS_DAILY_SHARE_PACK_LOCALES = [
  "ko",
  "en",
  "ja",
  "zh",
  "zh-tw",
] as const satisfies readonly SeoRouteLocale[];

export type PlusDailySharePackLocale =
  (typeof PLUS_DAILY_SHARE_PACK_LOCALES)[number];

export type PlusDailySharePackInput = {
  locale: PlusDailySharePackLocale;
  shortId: string;
  slug: string;
  facts: MemeUseKitFacts;
  usageExample?: UsageExample | null;
  channel?: PlusOutcomeChannel;
};

export type PlusDailySharePack = {
  caption: string;
  safetyNote: string;
  shareText: string;
  detailPath: string;
  exportPath: string;
};

export type PlusCreatorDraftFamily =
  | "visual_short_form"
  | "short_social"
  | "conversation"
  | "long_form"
  | "general";

type PlusDailySharePackLabels = MemeUseKitLabels & {
  usageExampleTitle: string;
};

const LABELS: Record<PlusDailySharePackLocale, PlusDailySharePackLabels> = {
  ko: {
    explainTitle: "설명",
    captionTitle: "캡션",
    safetyTitle: "사용 전 확인",
    safetyLabel: "안전 신호",
    usageLabel: "사용법",
    cautionLabel: "주의",
    trendLabel: "유행 상태",
    noGuidance: "추가 사용 안내가 없습니다.",
    usageExampleTitle: "상황별 한 줄",
    safety: {
      green: "대체로 사용 가능",
      yellow: "맥락 확인",
      gray: "대체로 지난 밈",
      red: "주의해서 사용",
    },
    lifecycle: {
      rising: "급상승",
      active: "유행 중",
      cooling: "식는 중",
      archived: "추억 밈",
    },
  },
  en: {
    explainTitle: "Explain",
    captionTitle: "Caption",
    safetyTitle: "Safety check",
    safetyLabel: "Safety",
    usageLabel: "Usage",
    cautionLabel: "Caution",
    trendLabel: "Trend",
    noGuidance: "No extra guidance is recorded.",
    usageExampleTitle: "Use it like this",
    safety: {
      green: "Generally usable",
      yellow: "Check context",
      gray: "Mostly dated",
      red: "Use with care",
    },
    lifecycle: {
      rising: "Rising",
      active: "Active",
      cooling: "Cooling",
      archived: "Archived",
    },
  },
  ja: {
    explainTitle: "説明",
    captionTitle: "キャプション",
    safetyTitle: "使用前の確認",
    safetyLabel: "安全シグナル",
    usageLabel: "使い方",
    cautionLabel: "注意",
    trendLabel: "トレンド",
    noGuidance: "追加の使用案内はありません。",
    usageExampleTitle: "こんな場面で",
    safety: {
      green: "通常は使用可",
      yellow: "文脈を確認",
      gray: "主に過去のミーム",
      red: "注意して使用",
    },
    lifecycle: {
      rising: "急上昇",
      active: "流行中",
      cooling: "下火",
      archived: "過去のミーム",
    },
  },
  zh: {
    explainTitle: "说明",
    captionTitle: "配文",
    safetyTitle: "使用前确认",
    safetyLabel: "安全信号",
    usageLabel: "用法",
    cautionLabel: "注意",
    trendLabel: "流行状态",
    noGuidance: "暂无额外使用说明。",
    usageExampleTitle: "适用场景",
    safety: {
      green: "通常可以使用",
      yellow: "请确认语境",
      gray: "大多已过时",
      red: "谨慎使用",
    },
    lifecycle: {
      rising: "快速上升",
      active: "正在流行",
      cooling: "热度下降",
      archived: "往期迷因",
    },
  },
  "zh-tw": {
    explainTitle: "說明",
    captionTitle: "貼文文字",
    safetyTitle: "使用前確認",
    safetyLabel: "安全訊號",
    usageLabel: "用法",
    cautionLabel: "注意",
    trendLabel: "流行狀態",
    noGuidance: "暫無額外使用說明。",
    usageExampleTitle: "適用情境",
    safety: {
      green: "通常可以使用",
      yellow: "請確認語境",
      gray: "大多已過時",
      red: "謹慎使用",
    },
    lifecycle: {
      rising: "快速上升",
      active: "正在流行",
      cooling: "熱度下降",
      archived: "往期迷因",
    },
  },
};

function exportPath(locale: PlusDailySharePackLocale, shortId: string): string {
  const path = `/memes/${encodeURIComponent(shortId)}/export`;
  return locale === "ko" ? path : `${path}?locale=${encodeURIComponent(locale)}`;
}

export function creatorDraftFamilyForChannel(
  channel: PlusOutcomeChannel,
): PlusCreatorDraftFamily {
  if (channel === "instagram" || channel === "tiktok" || channel === "youtube") {
    return "visual_short_form";
  }
  if (channel === "threads" || channel === "x") return "short_social";
  if (channel === "community" || channel === "messaging") return "conversation";
  if (channel === "blog") return "long_form";
  return "general";
}

function channelShareText({
  channel,
  caption,
  explanation,
  safetyNote,
  usageExampleLine,
  detailPath,
}: {
  channel: PlusOutcomeChannel;
  caption: string;
  explanation: string;
  safetyNote: string;
  usageExampleLine: string;
  detailPath: string;
}): string {
  const family = creatorDraftFamilyForChannel(channel);
  const sections =
    family === "visual_short_form"
      ? [caption, usageExampleLine, safetyNote, detailPath]
      : family === "short_social"
        ? [caption, usageExampleLine, detailPath, safetyNote]
        : family === "conversation"
          ? [usageExampleLine || explanation, caption, safetyNote, detailPath]
          : family === "long_form"
            ? [explanation, caption, usageExampleLine, safetyNote, detailPath]
            : [caption, safetyNote, usageExampleLine, detailPath];

  return sections.filter(Boolean).join("\n\n");
}

export function buildPlusDailySharePack({
  locale,
  shortId,
  slug,
  facts,
  usageExample,
  channel,
}: PlusDailySharePackInput): PlusDailySharePack {
  const kit = buildMemeUseKit(facts, LABELS[locale]);
  const explanation = kit.find((item) => item.id === "explain")?.body ?? "";
  const caption = kit.find((item) => item.id === "caption")?.body ?? "";
  const safetyNote = kit.find((item) => item.id === "safety")?.body ?? "";
  const detailPath = localizedMemePath(locale, shortId, slug);
  const validUsageExample =
    usageExample && usageExample.situation.trim() && usageExample.text.trim()
      ? usageExample
      : null;
  const usageExampleLine = validUsageExample
    ? `${LABELS[locale].usageExampleTitle} · ${validUsageExample.situation}\n${validUsageExample.text}`
    : "";

  const genericShareText = [caption, safetyNote, usageExampleLine, detailPath]
    .filter(Boolean)
    .join("\n\n");

  return {
    caption,
    safetyNote,
    shareText: channel
      ? channelShareText({
          channel,
          caption,
          explanation,
          safetyNote,
          usageExampleLine,
          detailPath,
        })
      : genericShareText,
    detailPath,
    exportPath: exportPath(locale, shortId),
  };
}
