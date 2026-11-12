import "server-only";

import {
  buildGlobalDailyCandidate,
  buildGlobalDailyQuestions,
  GLOBAL_DAILY_CANDIDATE_COUNT,
  globalDailyDate,
  type GlobalDailyBaseMeme,
  type GlobalDailyCandidate,
  type GlobalDailyLocale,
  type GlobalDailyTranslation,
} from "@/lib/global-daily-challenge";
import { createClient } from "@/lib/supabase/server";

type GlobalDailyScheduleRow = {
  challenge_date: string;
  candidate_meme_ids: string[] | null;
  completed_at: string | null;
  completion_locale: string | null;
  current_streak: number;
};

type GlobalDailyMemeRow = GlobalDailyBaseMeme;

export type GlobalDailyLoadState = "ready" | "completed" | "unavailable";

export type LoadedGlobalDailyChallenge = {
  state: GlobalDailyLoadState;
  challengeDate: string;
  locale: GlobalDailyLocale;
  questions: ReturnType<typeof buildGlobalDailyQuestions>;
  candidates: GlobalDailyCandidate[];
  completedAt: string | null;
  completionLocale: string | null;
  currentStreak: number;
};

function unavailable(challengeDate: string, locale: GlobalDailyLocale): LoadedGlobalDailyChallenge {
  return {
    state: "unavailable",
    challengeDate,
    locale,
    questions: [],
    candidates: [],
    completedAt: null,
    completionLocale: null,
    currentStreak: 0,
  };
}

export async function loadGlobalDailyChallenge(
  locale: GlobalDailyLocale,
  now = new Date(),
): Promise<LoadedGlobalDailyChallenge> {
  const challengeDate = globalDailyDate(now);
  try {
    const supabase = await createClient();
    const { data: scheduleRows, error: scheduleError } = await supabase.rpc(
      "get_plus_global_daily_challenge",
      { p_challenge_date: challengeDate },
    );
    if (scheduleError || !scheduleRows?.[0]) return unavailable(challengeDate, locale);

    const schedule = scheduleRows[0] as GlobalDailyScheduleRow;
    const candidateIds = schedule.candidate_meme_ids ?? [];
    if (candidateIds.length !== GLOBAL_DAILY_CANDIDATE_COUNT) {
      return unavailable(challengeDate, locale);
    }

    const [{ data: memeRows, error: memeError }, { data: translationRows, error: translationError }] =
      await Promise.all([
        supabase
          .from("memes")
          .select(
            "id, short_id, slug, title, summary, description, origin, usage_note, caution, usage_examples, category, origin_year, safety_level, lifecycle_status, moderation_status, updated_at, meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status), meme_tags_map(tag_id)",
          )
          .in("id", candidateIds),
        supabase
          .from("meme_translations")
          .select(
            "meme_id, locale, status, localized_slug, title, summary, description, origin, source_updated_at",
          )
          .in("meme_id", candidateIds)
          .in("locale", ["en", "ja", "zh", "zh-tw"])
          .eq("status", "reviewed"),
      ]);
    if (memeError || translationError || !memeRows || !translationRows) {
      return unavailable(challengeDate, locale);
    }

    const memesById = new Map(
      (memeRows as unknown as GlobalDailyMemeRow[]).map((meme) => [meme.id, meme]),
    );
    const translationsByMeme = new Map<string, GlobalDailyTranslation[]>();
    for (const row of translationRows as unknown as GlobalDailyTranslation[]) {
      const rows = translationsByMeme.get(row.meme_id) ?? [];
      rows.push(row);
      translationsByMeme.set(row.meme_id, rows);
    }

    const candidates: GlobalDailyCandidate[] = [];
    for (const candidateId of candidateIds) {
      const meme = memesById.get(candidateId);
      const candidate = meme
        ? buildGlobalDailyCandidate(meme, translationsByMeme.get(candidateId) ?? [])
        : null;
      if (!candidate) return unavailable(challengeDate, locale);
      candidates.push(candidate);
    }

    const questions = buildGlobalDailyQuestions(candidates, locale, challengeDate);
    if (questions.length !== 3) return unavailable(challengeDate, locale);

    return {
      state: schedule.completed_at ? "completed" : "ready",
      challengeDate,
      locale,
      questions,
      candidates,
      completedAt: schedule.completed_at,
      completionLocale: schedule.completion_locale,
      currentStreak: schedule.current_streak ?? 0,
    };
  } catch {
    return unavailable(challengeDate, locale);
  }
}
