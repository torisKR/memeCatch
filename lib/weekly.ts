/**
 * 레인 D — 주간 결산(/weekly) 데이터 조립.
 * 완전 자동(수동 큐레이션 0): KST 기준 이번 주(월~일) 범위를 계산하고
 * (a) 급상승 top10 (b) 신규 등록 밈 (c) 카테고리 분포 요약을 조립한다.
 * 전부 createStaticClient(쿠키 미사용, ISR 유지) + 개별 try/catch로 실패 시 빈 배열 폴백.
 */
import { createStaticClient } from "@/lib/supabase/server";
import type { MemeCategory } from "@/lib/labels";
import type { MemeListItem } from "@/lib/queries";

const LIST_SELECT = "*, meme_contents(thumbnail_url, is_representative)";
const PUBLIC_STATUSES = ["approved", "limited"] as const;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type WeekRange = {
  /** 주 시작(월요일 00:00 KST)을 UTC ISO 문자열로 표현 — DB 쿼리용 */
  startISO: string;
  /** 주 종료(일요일 23:59:59.999 KST) UTC ISO */
  endISO: string;
  /** KST 기준 "오늘"의 연/월 — 헤딩 표기용 */
  year: number;
  month: number;
  /** 이번 달 몇 주차인지(월요일 시작 기준, 대략적 표기용) */
  weekOfMonth: number;
  /** 이번 주가 아직 끝나지 않아 데이터가 부분적임 — "집계 중" 배지 트리거 */
  isOngoing: boolean;
};

/** KST 기준 이번 주(월~일) 범위 계산. 한국은 DST가 없어 고정 오프셋 계산이 안전하다. */
export function getCurrentWeekRangeKST(): WeekRange {
  const shiftedNow = new Date(Date.now() + KST_OFFSET_MS);
  const dayIdx = shiftedNow.getUTCDay(); // 0=일 ... 6=토
  const daysSinceMonday = (dayIdx + 6) % 7;

  const shiftedMonday = new Date(shiftedNow);
  shiftedMonday.setUTCHours(0, 0, 0, 0);
  shiftedMonday.setUTCDate(shiftedMonday.getUTCDate() - daysSinceMonday);

  const shiftedSunday = new Date(shiftedMonday);
  shiftedSunday.setUTCDate(shiftedSunday.getUTCDate() + 6);
  shiftedSunday.setUTCHours(23, 59, 59, 999);

  const startISO = new Date(shiftedMonday.getTime() - KST_OFFSET_MS).toISOString();
  const endISO = new Date(shiftedSunday.getTime() - KST_OFFSET_MS).toISOString();

  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth() + 1;
  const firstOfMonthWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  // 월요일 시작 주차 — getUTCDay()는 일요일=0이라 (요일+6)%7로 월요일 기준 오프셋 보정
  const mondayOffset = (firstOfMonthWeekday + 6) % 7;
  const weekOfMonth = Math.ceil((shiftedNow.getUTCDate() + mondayOffset) / 7);

  const isOngoing = shiftedNow.getTime() < shiftedSunday.getTime();

  return { startISO, endISO, year, month, weekOfMonth, isOngoing };
}

export type CategoryCount = {
  category: MemeCategory;
  count: number;
  percentage: number;
};

export type WeeklyDigest = {
  range: WeekRange;
  /** (a) 이번 주 급상승 top10 — trend_score desc, approved */
  trending: MemeListItem[];
  /** (b) 이번 주 신규 등록 밈 — published_at이 이번 주 범위 */
  fresh: MemeListItem[];
  /** (c) 카테고리 분포 요약 — 급상승∪신규 풀 기준, 개수 내림차순 */
  categoryBreakdown: CategoryCount[];
};

async function loadTrending(): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .eq("moderation_status", "approved")
      .order("trend_score", { ascending: false })
      .limit(10);
    if (error) throw error;
    return (data ?? []) as MemeListItem[];
  } catch {
    return [];
  }
}

async function loadFresh(range: WeekRange): Promise<MemeListItem[]> {
  try {
    const supabase = createStaticClient();
    const { data, error } = await supabase
      .from("memes")
      .select(LIST_SELECT)
      .in("moderation_status", [...PUBLIC_STATUSES])
      .gte("published_at", range.startISO)
      .lte("published_at", range.endISO)
      .order("published_at", { ascending: false })
      .limit(24);
    if (error) throw error;
    return (data ?? []) as MemeListItem[];
  } catch {
    return [];
  }
}

function buildCategoryBreakdown(pool: MemeListItem[]): CategoryCount[] {
  const counts = new Map<MemeCategory, number>();
  for (const m of pool) {
    const cat = m.category as MemeCategory;
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }
  const total = pool.length;
  if (total === 0) return [];
  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
}

/** 주간 결산 데이터 조립 — 개별 실패는 빈 배열로 격리, 전체를 절대 throw하지 않는다 */
export async function getWeeklyDigest(): Promise<WeeklyDigest> {
  const range = getCurrentWeekRangeKST();
  const [trending, fresh] = await Promise.all([loadTrending(), loadFresh(range)]);

  // 카테고리 분포는 급상승∪신규를 합쳐(중복 제거) 계산 — 한쪽이 비어도 다른 쪽으로 우아하게 폴백
  const pool = new Map<string, MemeListItem>();
  for (const m of trending) pool.set(m.id, m);
  for (const m of fresh) pool.set(m.id, m);

  return {
    range,
    trending,
    fresh,
    categoryBreakdown: buildCategoryBreakdown([...pool.values()]),
  };
}
