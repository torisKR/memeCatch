import { createStaticClient } from "@/lib/db/server";
import { buildQuestions, type QuizPoolMeme } from "@/lib/quiz";
import { dailyPivot, hashCode, kstDayKey, seededRng } from "@/lib/daily-quiz";

/**
 * GET /api/daily-quiz — 오늘의 밈 퀴즈 1문항(무료).
 * KST 날짜로 피벗·셔플 시드를 고정해 같은 날에는 모두 같은 문제를 받는다.
 * 문항 조립·마스킹은 밈력고사(lib/quiz)와 같은 순수 로직을 재사용한다.
 * 짧은 CDN 캐시만 둔다 — 자정(KST) 직후 최대 5분은 전날 문제가 보일 수 있다.
 */
export const dynamic = "force-dynamic";

const POOL_SIZE = 120;
const COLUMNS = "short_id, slug, title, summary, category, origin_year, safety_level";

export async function GET() {
  const day = kstDayKey();
  const pivot = dailyPivot(day);

  try {
    const db = createStaticClient();
    const first = await db
      .from("memes")
      .select(COLUMNS)
      .eq("moderation_status", "approved")
      .gte("short_id", pivot)
      .order("short_id", { ascending: true })
      .limit(POOL_SIZE);
    if (first.error || !first.data) throw first.error ?? new Error("empty pool");

    let pool = first.data as QuizPoolMeme[];
    if (pool.length < POOL_SIZE) {
      const wrapped = await db
        .from("memes")
        .select(COLUMNS)
        .eq("moderation_status", "approved")
        .lt("short_id", pivot)
        .order("short_id", { ascending: true })
        .limit(POOL_SIZE - pool.length);
      if (wrapped.error) throw wrapped.error;
      pool = [...pool, ...((wrapped.data ?? []) as QuizPoolMeme[])];
    }

    const [question] = buildQuestions(pool, 1, seededRng(hashCode(`daily-quiz:${day}`)));
    if (!question) throw new Error("insufficient pool");

    return Response.json(
      { date: day, question },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } },
    );
  } catch {
    return Response.json(
      { error: "오늘의 퀴즈를 불러오지 못했어요.", code: "DAILY_QUIZ_UNAVAILABLE" },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
