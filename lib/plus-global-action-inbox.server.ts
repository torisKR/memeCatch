import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  PlusGlobalActionInboxCompletion,
} from "@/lib/plus-global-action-inbox";

export type PlusGlobalActionInboxSupabase = Awaited<ReturnType<typeof createClient>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  return value;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

export async function loadPlusGlobalActionInboxCompletion({
  supabase,
  isPremium,
}: {
  supabase: PlusGlobalActionInboxSupabase;
  isPremium: boolean;
}): Promise<PlusGlobalActionInboxCompletion> {
  if (!isPremium) {
    return {
      status: "unavailable",
      completedMemeIds: [],
      completedTodayCount: 0,
      currentStreak: 0,
    };
  }

  const { data, error } = await supabase.rpc("get_plus_meme_use_summary");
  if (error || !isRecord(data)) {
    return {
      status: "unavailable",
      completedMemeIds: [],
      completedTodayCount: 0,
      currentStreak: 0,
    };
  }

  const completedMemeIds = stringArray(data.completed_meme_ids);
  const completedTodayCount = nonNegativeInteger(data.completed_today_count);
  const currentStreak = nonNegativeInteger(data.current_streak);
  if (!completedMemeIds || completedTodayCount === null || currentStreak === null) {
    return {
      status: "unavailable",
      completedMemeIds: [],
      completedTodayCount: 0,
      currentStreak: 0,
    };
  }

  return {
    status: "available",
    completedMemeIds,
    completedTodayCount,
    currentStreak,
  };
}
