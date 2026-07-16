import { createStaticClient } from "@/lib/supabase/server";
import {
  buildQuestions,
  QUIZ_SIZE,
  type QuizMode,
  type QuizPoolMeme,
} from "@/lib/quiz";

/**
 * GET /api/quiz?mode=all|now|retro — 밈력고사 문항 10개 생성.
 * - mode=now: origin_year ≥ 2020 (요즘 밈 모드) / retro: ≤ 2009 (추억 밈 모드)
 * - 무작위: random() DB 정렬 대신 count → 랜덤 오프셋으로 300개 풀을 받아
 *   서버에서 셔플·조립 (비용 O(풀 크기), 매 호출 새 문제)
 * - createStaticClient(쿠키 미접근) + no-store — 항상 동적 실행
 */
export const dynamic = "force-dynamic";

const POOL_SIZE = 300;
const MODE_YEAR_FILTER: Record<QuizMode, { gte?: number; lte?: number }> = {
  all: {},
  now: { gte: 2020 },
  retro: { lte: 2009 },
};

function parseMode(value: string | null): QuizMode {
  return value === "now" || value === "retro" ? value : "all";
}

export async function GET(request: Request) {
  const mode = parseMode(new URL(request.url).searchParams.get("mode"));
  const yearFilter = MODE_YEAR_FILTER[mode];

  try {
    const supabase = createStaticClient();

    // 1) 대상 밈 수 — 랜덤 오프셋 상한 계산용
    let countQuery = supabase
      .from("memes")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "approved");
    if (yearFilter.gte !== undefined)
      countQuery = countQuery.gte("origin_year", yearFilter.gte);
    if (yearFilter.lte !== undefined)
      countQuery = countQuery.lte("origin_year", yearFilter.lte);
    const { count, error: countError } = await countQuery;
    if (countError || !count) throw countError ?? new Error("no memes");

    // 2) 랜덤 오프셋에서 풀 300개 — 안정 정렬(short_id) 위에서 창만 이동
    const offset = Math.floor(Math.random() * Math.max(1, count - POOL_SIZE + 1));
    let poolQuery = supabase
      .from("memes")
      .select("short_id, slug, title, summary, category, origin_year, safety_level")
      .eq("moderation_status", "approved");
    if (yearFilter.gte !== undefined)
      poolQuery = poolQuery.gte("origin_year", yearFilter.gte);
    if (yearFilter.lte !== undefined)
      poolQuery = poolQuery.lte("origin_year", yearFilter.lte);
    const { data, error } = await poolQuery
      .order("short_id", { ascending: true })
      .range(offset, offset + POOL_SIZE - 1);
    if (error || !data) throw error ?? new Error("empty pool");

    // 3) 요약 20자+ 필터·같은 카테고리 오답 3개·보기 셔플은 순수 로직에 위임
    const questions = buildQuestions(data as QuizPoolMeme[], QUIZ_SIZE);
    if (questions.length < QUIZ_SIZE) throw new Error("insufficient pool");

    return Response.json(
      { mode, questions },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      {
        error: "퀴즈 문항을 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
        code: "QUIZ_GENERATION_FAILED",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
