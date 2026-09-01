/**
 * 레인 B — 공개 화면 읽기 쿼리 모음.
 * 전부 인증 쿠키 없는 createStaticClient 기반이지만, 이 선택 자체는 데이터를 캐시하지 않는다.
 * React cache로 감싼 함수만 한 번의 서버 렌더 요청 안에서 중복 호출을 제거한다.
 * 쓰기는 절대 여기서 하지 않는다(쓰기는 RPC — 클라이언트 컴포넌트에서 호출).
 */
import { cache } from "react";
import { createStaticClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { MemeCategory } from "@/lib/labels";
import type { Audience } from "@/lib/meme-commerce";
import type { MemeOriginProfile } from "@/lib/meme-country";

export type MemeRow = Database["public"]["Tables"]["memes"]["Row"];
export type MemeContentRow = Database["public"]["Tables"]["meme_contents"]["Row"];
export type MemeSourceRow = Database["public"]["Tables"]["meme_sources"]["Row"];
export type ReactionType = Database["public"]["Enums"]["reaction_type"];

/**
 * 목록 카드가 실제로 읽는 컬럼만 명시 — memes 테이블의 장문 컬럼(description,
 * origin, usage_note, usage_context, caution, aliases, title_chosung 등)은
 * 목록에서 렌더하지 않으므로 select에서 제외해 전송량을 줄인다.
 * 목록 소비처가 새 컬럼을 읽게 되면 이 배열에 추가할 것(MemeListItem이 자동 반영).
 * ⚠️ components/explore-grid.tsx의 MEME_LIST_COLUMNS와 반드시 동기화
 *    ("use client" 경계라 이 모듈(서버 클라이언트 의존)을 값으로 import할 수 없다).
 */
export const LIST_COLUMNS =
  "id, short_id, slug, title, summary, category, safety_level, lifecycle_status, media_type, origin_year, trend_score" as const;

/** "a, b, c" 리터럴 → "a" | "b" | "c" — LIST_COLUMNS와 MemeListItem의 동기화를 타입으로 강제 */
type SplitColumns<S extends string> = S extends `${infer Head}, ${infer Tail}`
  ? Head | SplitColumns<Tail>
  : S;
type MemeListColumn = SplitColumns<typeof LIST_COLUMNS>;

/**
 * 카드 썸네일용 — 목록 쿼리에 대표 콘텐츠 썸네일만 실어 온다.
 * LIST_COLUMN_LIST에 없는 memes 컬럼은 런타임에도 없으므로 타입에서도 제외한다.
 * meme_contents의 platform/url, meme_sources는 explore 계열 select에서만 실려 와 optional.
 */
export type MemeListItem = Pick<MemeRow, MemeListColumn> & {
  meme_contents?: (Pick<MemeContentRow, "thumbnail_url" | "is_representative"> &
    Partial<Pick<MemeContentRow, "platform" | "url">>)[];
  meme_sources?: Pick<MemeSourceRow, "platform" | "source_url">[];
  meme_market_profiles?: MemeOriginProfile[];
};

export type MemeDetail = MemeRow & {
  meme_contents: MemeContentRow[];
  meme_sources: MemeSourceRow[];
  meme_tags_map: { tag_id: string; tags: { name: string } | null }[];
  meme_market_profiles?: MemeOriginProfile[];
};

export type GenerationHighlight = {
  ageGroup: Audience;
  totalVotes: number;
  meme: MemeListItem;
};

const PUBLIC_STATUSES = ["approved", "limited"] as const;
export const LIST_SELECT =
  `${LIST_COLUMNS}, meme_contents(thumbnail_url, is_representative), meme_market_profiles(market_code, role, review_state)` as const;

/** 오늘의 급상승 — 2026년 등장·국내 유행 밈을 trend_score 순으로 표시 */
export async function getTrendingMemes(limit = 10): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .or("origin_year.eq.2026,korea_viral_year.eq.2026")
      .order("trend_score", { ascending: false })
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data as MemeListItem[];
  } catch {
    return [];
  }
}

/**
 * 최신 밈 — 유래 연도(origin_year) 최신순. 홈 "이번 주 이것만 알면 됩니다" 브리핑용.
 * DB에는 유래가 연 단위(origin_year)로만 기록되므로 "이번 달"까지는 특정 불가 —
 * 가장 최근 연도(2026) 밈을 우선하고, 같은 연도 안에서는 화제성(trend_score)·
 * 등록 최신순으로 정렬해 "요즘 새로 뜬 밈"을 앞세운다.
 */
export async function getLatestMemes(limit = 6): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .not("origin_year", "is", null)
      .order("origin_year", { ascending: false })
      .order("trend_score", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as MemeListItem[];
  } catch {
    return [];
  }
}

/** 지금 알아도 충분한 밈 — difficulty=beginner */
export async function getBeginnerMemes(limit = 8): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .eq("difficulty", "beginner")
      .order("trend_score", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as MemeListItem[];
  } catch {
    return [];
  }
}

/**
 * 20·30·40대별 "알아요/써요" 투표 상위 밈.
 * 표본이 없거나 조회가 실패하면 빈 배열을 반환하고 뉴스 브리핑만 노출한다.
 */
export async function getGenerationHighlights(
  limitPerGroup = 3
): Promise<Record<Audience, GenerationHighlight[]>> {
  const empty: Record<Audience, GenerationHighlight[]> = {
    "20s": [],
    "30s": [],
    "40s": [],
  };

  try {
    const supabase = createStaticClient();
    const { data: stats, error: statsError } = await supabase
      .from("generation_vote_stats")
      .select("age_group,vote,cnt,meme_id")
      .in("age_group", ["20s", "30s", "40s"])
      .in("vote", ["know", "use"]);

    if (statsError || !stats?.length) return empty;

    const scores = new Map<string, number>();
    for (const row of stats) {
      if (!row.age_group || !row.meme_id) continue;
      const key = `${row.age_group}:${row.meme_id}`;
      scores.set(key, (scores.get(key) ?? 0) + (row.cnt ?? 0));
    }

    const memeIds = [...new Set(stats.flatMap((row) => (row.meme_id ? [row.meme_id] : [])))];
    if (!memeIds.length) return empty;

    const { data: memes, error: memesError } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("id", memeIds)
      .in("moderation_status", [...PUBLIC_STATUSES]);

    if (memesError || !memes?.length) return empty;
    const memeById = new Map((memes as MemeListItem[]).map((meme) => [meme.id, meme]));

    for (const ageGroup of ["20s", "30s", "40s"] as const) {
      empty[ageGroup] = [...scores.entries()]
        .filter(([key]) => key.startsWith(`${ageGroup}:`))
        .map(([key, totalVotes]) => ({
          ageGroup,
          totalVotes,
          meme: memeById.get(key.slice(ageGroup.length + 1)),
        }))
        .filter((item): item is GenerationHighlight => Boolean(item.meme))
        .sort(
          (a, b) =>
            b.totalVotes - a.totalVotes ||
            (b.meme.trend_score ?? 0) - (a.meme.trend_score ?? 0)
        )
        .slice(0, limitPerGroup);
    }

    return empty;
  } catch {
    return empty;
  }
}

/** 상세 조회 — generateMetadata와 본문에서 중복 호출되므로 React cache로 dedupe */
export const getMemeByShortId = cache(
  async (shortId: string): Promise<MemeDetail | null> => {
    if (!shortId) return null;
    try {
      const supabase = createStaticClient();
      const { data, error } = await supabase
        .from("memes")
        .select("*, meme_contents(*), meme_sources(*), meme_tags_map(tag_id, tags(name)), meme_market_profiles(market_code, role, review_state)")
        .eq("short_id", shortId)
        .in("moderation_status", [...PUBLIC_STATUSES])
        .maybeSingle();
      if (error || !data) return null;
      return data as unknown as MemeDetail;
    } catch {
      return null;
    }
  }
);

/** 관련 밈 — 같은 태그 우선, 부족하면 같은 카테고리에서 연도 근접순으로 채움 (최대 4개) */
/**
 * 관련 밈 — CEO 플랜 Wave 1 스코어링:
 *   태그 공유 여부×3 + 동일 카테고리×2 + |연도차|≤2×1, 동점 시 trend_score 내림차순.
 * 후보 풀: 태그 공유 밈(최대 30) ∪ 동일 카테고리 상위 24 ∪ 연도 인접(±2) 상위 12.
 */
export async function getRelatedMemes(
  meme: { id: string; category: MemeCategory; origin_year: number | null },
  tagIds: string[],
  limit = 9
): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const taggedIds = new Set<string>();

    // 태그맵→태그밈 2단계 체인만 진짜 의존 관계 — 체인을 async IIFE로 묶어
    // sameCat·nearYear 조회와 병렬 실행한다(직렬 4회 → 병렬, 대기 시간 단축).
    const taggedPromise = (async (): Promise<MemeListItem[] | null> => {
      if (tagIds.length === 0) return null;
      const { data: mapRows } = await supabase
        .from("meme_tags_map")
        .select("meme_id")
        .in("tag_id", tagIds)
        .neq("meme_id", meme.id)
        .limit(30);
      for (const r of mapRows ?? []) taggedIds.add(r.meme_id);
      if (taggedIds.size === 0) return null;
      const { data } = await supabase
        .from("memes")
        .select(LIST_SELECT)
        .in("id", [...taggedIds])
        .in("moderation_status", [...PUBLIC_STATUSES])
        .order("trend_score", { ascending: false })
        .limit(30);
      return data as MemeListItem[] | null;
    })();

    const sameCatPromise = (async (): Promise<MemeListItem[] | null> => {
      const { data } = await supabase
        .from("memes")
        .select(LIST_SELECT)
        .eq("category", meme.category)
        .neq("id", meme.id)
        .in("moderation_status", [...PUBLIC_STATUSES])
        .order("trend_score", { ascending: false })
        .limit(24);
      return data as MemeListItem[] | null;
    })();

    const nearYearPromise = (async (): Promise<MemeListItem[] | null> => {
      if (meme.origin_year == null) return null;
      const { data } = await supabase
        .from("memes")
        .select(LIST_SELECT)
        .gte("origin_year", meme.origin_year - 2)
        .lte("origin_year", meme.origin_year + 2)
        .neq("id", meme.id)
        .in("moderation_status", [...PUBLIC_STATUSES])
        .order("trend_score", { ascending: false })
        .limit(12);
      return data as MemeListItem[] | null;
    })();

    const [tagged, sameCat, nearYear] = await Promise.all([
      taggedPromise,
      sameCatPromise,
      nearYearPromise,
    ]);

    // 병합 순서는 기존 직렬 버전과 동일하게 유지: 태그밈 → 동일 카테고리 → 연도 인접
    const pool = new Map<string, MemeListItem>();
    const collect = (rows: MemeListItem[] | null) => {
      for (const m of rows ?? []) if (m.id !== meme.id) pool.set(m.id, m);
    };
    collect(tagged);
    collect(sameCat);
    collect(nearYear);

    const score = (m: MemeListItem) =>
      (taggedIds.has(m.id) ? 3 : 0) +
      (m.category === meme.category ? 2 : 0) +
      (meme.origin_year != null &&
      m.origin_year != null &&
      Math.abs(m.origin_year - meme.origin_year) <= 2
        ? 1
        : 0);

    return [...pool.values()]
      .sort((a, b) => score(b) - score(a) || (b.trend_score ?? 0) - (a.trend_score ?? 0))
      .slice(0, limit);
  } catch {
    // 관련 밈 실패는 치명적이지 않음 — 섹션 숨김으로 처리
    return [];
  }
}

/** 반응 카운트 — 집계 뷰(meme_reaction_counts) */
export async function getReactionCounts(
  memeId: string
): Promise<Partial<Record<ReactionType, number>>> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("meme_reaction_counts")
      .select("reaction, cnt")
      .eq("meme_id", memeId);
    if (error || !data) return {};
    const counts: Partial<Record<ReactionType, number>> = {};
    for (const row of data) {
      if (row.reaction) counts[row.reaction] = row.cnt ?? 0;
    }
    return counts;
  } catch {
    return {};
  }
}

/** 검색 — search_memes RPC (trgm + 초성 + aliases 통합, 서버가 전부 처리) */
export async function searchMemes(query: string, limit = 20): Promise<MemeRow[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase.rpc("search_memes", {
      p_query: q,
      p_limit: limit,
    });
    if (error || !data) return [];
    return data as MemeRow[];
  } catch {
    return [];
  }
}

/** /slang 사전 행 — 표제어·한 줄 뜻·신호등·연도만 싣는 경량 행 */
export type SlangTermRow = Pick<
  MemeRow,
  | "id"
  | "short_id"
  | "slug"
  | "title"
  | "summary"
  | "safety_level"
  | "origin_year"
  | "trend_score"
>;

/**
 * /slang — 연대(origin_year 범위)별 유행어(category=phrase) 상위 조회.
 * trend_score 내림차순 + id 내림차순(동점 안정 정렬 — explore와 동일 규칙).
 */
export async function getSlangTermsByYearRange(
  fromYear: number,
  toYear: number,
  limit = 60
): Promise<SlangTermRow[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(
        "id, short_id, slug, title, summary, safety_level, origin_year, trend_score"
      )
      .eq("category", "phrase")
      .in("moderation_status", [...PUBLIC_STATUSES])
      .gte("origin_year", fromYear)
      .lte("origin_year", toYear)
      .order("trend_score", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as SlangTermRow[];
  } catch {
    return [];
  }
}

/** 공개 밈 총 수 — 히어로 카운트업용(head 카운트, 행 미전송) */
export async function getTotalMemeCount(): Promise<number> {
  try {
    const supabase = createStaticClient();
    const { count, error } = await supabase
      .from("memes")
      .select("id", { count: "exact", head: true })
      .in("moderation_status", ["approved", "limited"]);
    if (error || count == null) return 0;
    return count;
  } catch {
    return 0;
  }
}
