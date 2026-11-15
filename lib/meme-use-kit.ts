import type { LifecycleStatus, SafetyLevel } from "@/lib/labels";

export type MemeUseKitFacts = {
  title: string;
  summary: string;
  usageNote: string | null | undefined;
  caution: string | null | undefined;
  safetyLevel: SafetyLevel;
  lifecycleStatus: LifecycleStatus;
};

export type MemeUseKitLabels = {
  explainTitle: string;
  captionTitle: string;
  safetyTitle: string;
  safetyLabel: string;
  usageLabel: string;
  cautionLabel: string;
  trendLabel: string;
  noGuidance: string;
  safety: Record<SafetyLevel, string>;
  lifecycle: Record<LifecycleStatus, string>;
};

export type MemeUseKitItem = {
  id: "explain" | "caption" | "safety";
  title: string;
  body: string;
};

function prose(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

export function buildMemeUseKit(
  facts: MemeUseKitFacts,
  labels: MemeUseKitLabels,
): MemeUseKitItem[] {
  const title = prose(facts.title);
  const summary = prose(facts.summary);
  const usageNote = prose(facts.usageNote);
  const caution = prose(facts.caution);

  return [
    {
      id: "explain",
      title: labels.explainTitle,
      body: `${title}: ${summary}`,
    },
    {
      id: "caption",
      title: labels.captionTitle,
      body: [
        title,
        summary,
        `${labels.trendLabel}: ${labels.lifecycle[facts.lifecycleStatus]}`,
      ].join("\n"),
    },
    {
      id: "safety",
      title: labels.safetyTitle,
      body: [
        `${labels.safetyLabel}: ${labels.safety[facts.safetyLevel]}`,
        usageNote ? `${labels.usageLabel}: ${usageNote}` : "",
        caution ? `${labels.cautionLabel}: ${caution}` : labels.noGuidance,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}
