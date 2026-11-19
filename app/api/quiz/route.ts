import { createStaticClient } from "@/lib/db/server";
import {
  buildQuestions,
  buildQuestionsForSet,
  QUIZ_SIZE,
  seededRng,
  type QuizMode,
  type QuizPoolMeme,
} from "@/lib/quiz";
import { QUIZ_SHORT_ID_PATTERN } from "@/lib/quiz-share";

/**
 * GET /api/quiz?mode=all|now|retro — 밈력고사 문항 10개 생성.
 * - mode=now: origin_year ≥ 2020 (요즘 밈 모드) / retro: ≤ 2009 (추억 밈 모드)
 * - 무작위: random() DB 정렬 대신 count → 랜덤 오프셋으로 300개 풀을 받아
 *   서버에서 셔플·조립 (비용 O(풀 크기), 매 호출 새 문제)
 * - createStaticClient(쿠키 미접근) + no-store — 항상 동적 실행
 *
 * GET /api/quiz?mode=…&set=id1,id2,… — 공유 링크 "내 점수 이겨보기".
 * - set의 short_id 순서대로 같은 밈을 다시 출제하고, 오답 풀·보기 셔플은
 *   세트로 시드해 친구가 푼 것과 최대한 같은 보기를 재현한다.
 */
export const dynamic = "force-dynamic";

const POOL_SIZE = 300;
const SHORT_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const MODE_YEAR_FILTER: Record<QuizMode, { gte?: number; lte?: number }> = {
  all: {},
  now: { gte: 2020 },
  retro: { lte: 2009 },
};

function parseMode(value: string | null): QuizMode {
  return value === "now" || value === "retro" ? value : "all";
}

const POOL_COLUMNS =
  "short_id, slug, title, summary, category, origin_year, safety_level";

type Db = ReturnType<typeof createStaticClient>;

function parseSet(value: string | null): string[] | null {
  if (!value) return null;
  const ids = value.split(",").map((id) => id.trim());
  if (ids.length === 0 || ids.length > QUIZ_SIZE) return null;
  if (!ids.every((id) => QUIZ_SHORT_ID_PATTERN.test(id))) return null;
  if (new Set(ids).size !== ids.length) return null;
  return ids;
}

/** pivot 이후 short_id 순으로 풀을 받고, 모자라면 앞쪽에서 wrap-around */
async function fetchPool(db: Db, pivot: string, mode: QuizMode): Promise<QuizPoolMeme[]> {
  const yearFilter = MODE_YEAR_FILTER[mode];
  let poolQuery = db
    .from("memes")
    .select(POOL_COLUMNS)
    .eq("moderation_status", "approved")
    .gte("short_id", pivot);
  if (yearFilter.gte !== undefined)
    poolQuery = poolQuery.gte("origin_year", yearFilter.gte);
  if (yearFilter.lte !== undefined)
    poolQuery = poolQuery.lte("origin_year", yearFilter.lte);
  const { data: first, error } = await poolQuery
    .order("short_id", { ascending: true })
    .limit(POOL_SIZE);
  if (error || !first) throw error ?? new Error("empty pool");

  let data = first;
  if (data.length < POOL_SIZE) {
    let wrapQuery = db
      .from("memes")
      .select(POOL_COLUMNS)
      .eq("moderation_status", "approved")
      .lt("short_id", pivot);
    if (yearFilter.gte !== undefined)
      wrapQuery = wrapQuery.gte("origin_year", yearFilter.gte);
    if (yearFilter.lte !== undefined)
      wrapQuery = wrapQuery.lte("origin_year", yearFilter.lte);
    const wrapped = await wrapQuery
      .order("short_id", { ascending: true })
      .limit(POOL_SIZE - data.length);
    if (wrapped.error) throw wrapped.error;
    data = [...data, ...(wrapped.data ?? [])];
  }
  return data as QuizPoolMeme[];
}

async function fetchSetQuestions(db: Db, ids: string[], mode: QuizMode) {
  const { data, error } = await db
    .from("memes")
    .select(POOL_COLUMNS)
    .eq("moderation_status", "approved")
    .in("short_id", ids);
  if (error || !data) throw error ?? new Error("empty set");
  const byId = new Map((data as QuizPoolMeme[]).map((m) => [m.short_id, m]));
  const targets = ids.flatMap((id) => byId.get(id) ?? []);
  // 풀 시작점도 세트로 고정 — 같은 세트는 같은 오답 후보에서 보기를 뽑는다
  const pool = await fetchPool(db, ids[0]!, mode);
  return buildQuestionsForSet(targets, pool, seededRng(ids.join("")));
}

function randomShortId(): string {
  return Array.from({ length: 8 }, () =>
    SHORT_ID_ALPHABET[Math.floor(Math.random() * SHORT_ID_ALPHABET.length)]
  ).join("");
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const mode = parseMode(params.get("mode"));
  const rawSet = params.get("set");
  const set = parseSet(rawSet);

  if (rawSet !== null && !set) {
    return Response.json(
      { error: "잘못된 문제 세트예요.", code: "QUIZ_INVALID_SET" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const db = createStaticClient();

    if (set) {
      const questions = await fetchSetQuestions(db, set, mode);
      // 삭제·비공개된 밈이 섞여도 절반 이상 남으면 출제
      if (questions.length < Math.ceil(set.length / 2)) throw new Error("insufficient set");
      return Response.json(
        { mode, questions },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const pool = await fetchPool(db, randomShortId(), mode);

    // 요약 20자+ 필터·같은 카테고리 오답 3개·보기 셔플은 순수 로직에 위임
    const questions = buildQuestions(pool, QUIZ_SIZE);
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
