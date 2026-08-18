import { z } from "zod";

export const ENGLISH_PILOT_STATUSES = [
  "open",
  "assigned",
  "ready",
  "published",
  "paused",
] as const;

export type EnglishPilotStatus = (typeof ENGLISH_PILOT_STATUSES)[number];

const nullableText = z.string().nullable();

const dashboardSchema = z.object({
  slots: z.array(
    z.object({
      slot: z.number().int().min(1).max(20),
      memeId: nullableText,
      status: z.enum(ENGLISH_PILOT_STATUSES),
      operatorNote: z.string(),
      publishedAt: nullableText,
      translationCurrent: z.boolean(),
      title: nullableText,
      englishTitle: nullableText,
      landingPath: nullableText,
    }),
  ),
  candidates: z.array(
    z.object({
      memeId: z.string().uuid(),
      title: z.string(),
      englishTitle: z.string(),
      landingPath: z.string(),
    }),
  ),
  interviewCount: z.number().int().nonnegative(),
  interviews: z.array(
    z.object({
      id: z.string().uuid(),
      participantReference: z.string(),
      interviewedAt: z.string(),
      market: z.string(),
      segment: z.string(),
      summary: z.string(),
      evidenceUrl: nullableText,
    }),
  ),
});

export type GrowthPilotDashboard = z.infer<typeof dashboardSchema>;

export function parseGrowthPilotDashboard(value: unknown): GrowthPilotDashboard {
  return dashboardSchema.parse(value);
}

export function summarizeGrowthPilot(dashboard: GrowthPilotDashboard) {
  const assigned = dashboard.slots.filter((slot) => slot.memeId !== null).length;
  const ready = dashboard.slots.filter((slot) =>
    slot.translationCurrent && (slot.status === "ready" || slot.status === "published"),
  ).length;
  const published = dashboard.slots.filter(
    (slot) => slot.translationCurrent && slot.status === "published",
  ).length;
  const stale = dashboard.slots.filter(
    (slot) => slot.memeId !== null && !slot.translationCurrent,
  ).length;
  return {
    totalSlots: 20,
    assigned,
    ready,
    published,
    stale,
    interviews: dashboard.interviewCount,
    interviewGateMet: dashboard.interviewCount >= 10,
    complete: published === 20 && dashboard.interviewCount >= 10,
  };
}
