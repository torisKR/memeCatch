/**
 * 레인 B — 공개 화면 읽기 쿼리 모음.
 * 전부 createStaticClient(쿠키 미사용) 기반 — ISR 경로에서 dynamic 강등을 막는다.
 * 쓰기는 절대 여기서 하지 않는다(쓰기는 RPC — 클라이언트 컴포넌트에서 호출).
 */
import { cache } from "react";
import { createStaticClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { MemeCategory } from "@/lib/labels";
import type { Audience } from "@/lib/meme-commerce";

export type MemeRow = Database["public"]["Tables"]["memes"]["Row"];
export type MemeContentRow = Database["public"]["Tables"]["meme_contents"]["Row"];
export type MemeSourceRow = Database["public"]["Tables"]["meme_sources"]["Row"];
export type ReactionType = Database["public"]["Enums"]["reaction_type"];

/** 카드 썸네일용 — 목록 쿼리에 대표 콘텐츠 썸네일만 실어 온다 */
export type MemeListItem = MemeRow & {
  meme_contents?: Pick<MemeContentRow, "thumbnail_url" | "is_representative">[];
};

export type MemeDetail = MemeRow & {
  meme_contents: MemeContentRow[];
  meme_sources: MemeSourceRow[];
  meme_tags_map: { tag_id: string; tags: { name: string } | null }[];
};

export type GenerationHighlight = {
  ageGroup: Audience;
  totalVotes: number;
  meme: MemeListItem;
};

const PUBLIC_STATUSES = ["approved", "limited"] as const;
const LIST_SELECT = "*, meme_contents(thumbnail_url, is_representative)";

/** 오늘의 급상승 — trend_score desc, lifecycle=rising 우선(안정 정렬) */
export async function getTrendingMemes(limit = 10): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .order("trend_score", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return [...(data as MemeListItem[])].sort(
      (a, b) =>
        Number(b.lifecycle_status === "rising") -
        Number(a.lifecycle_status === "rising")
    );
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
        .select("*, meme_contents(*), meme_sources(*), meme_tags_map(tag_id, tags(name))")
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
    if (tagIds.length > 0) {
      const { data: mapRows } = await supabase
        .from("meme_tags_map")
        .select("meme_id")
        .in("tag_id", tagIds)
        .neq("meme_id", meme.id)
        .limit(30);
      for (const r of mapRows ?? []) taggedIds.add(r.meme_id);
    }

    const pool = new Map<string, MemeListItem>();
    const collect = (rows: MemeListItem[] | null) => {
      for (const m of rows ?? []) if (m.id !== meme.id) pool.set(m.id, m);
    };
    if (taggedIds.size > 0) {
      const { data } = await supabase
        .from("memes")
        .select(LIST_SELECT)
        .in("id", [...taggedIds])
        .in("moderation_status", [...PUBLIC_STATUSES])
        .limit(30);
      collect(data as MemeListItem[] | null);
    }
    const { data: sameCat } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .eq("category", meme.category)
      .neq("id", meme.id)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .order("trend_score", { ascending: false })
      .limit(24);
    collect(sameCat as MemeListItem[] | null);
    if (meme.origin_year != null) {
      const { data: nearYear } = await supabase
        .from("memes")
        .select(LIST_SELECT)
        .gte("origin_year", meme.origin_year - 2)
        .lte("origin_year", meme.origin_year + 2)
        .neq("id", meme.id)
        .in("moderation_status", [...PUBLIC_STATUSES])
        .order("trend_score", { ascending: false })
        .limit(12);
      collect(nearYear as MemeListItem[] | null);
    }

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
