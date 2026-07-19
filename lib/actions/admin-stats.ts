import "server-only";

/**
 * 관리자 대시보드 집계.
 * view_events·profiles·billing_* 는 RLS로 본인 것만 보이거나 공개 정책이 없어
 * service-role로 읽는다. 호출부(관리자 페이지)가 requireOperatorPage로 이미 보호된다.
 *
 * GA4가 아니라 우리 DB를 쓴다 — increment_view가 session_hash로 일 단위 중복을
 * 제거하므로 "순 세션"을 그대로 셀 수 있고, 외부 API 의존이 없다.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type DailyPoint = { date: string; views: number; sessions: number };

export type AdminStats = {
  today: { views: number; sessions: number };
  yesterday: { views: number; sessions: number };
  last14: DailyPoint[];
  totals: {
    users: number;
    newUsers7d: number;
    plusActive: number;
    savedMemes: number;
    communityPosts: number;
  };
  topMemes: { id: string; title: string; shortId: string; slug: string; views: number }[];
};

function seoulDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export async function getAdminStats(): Promise<AdminStats> {
  const admin = createAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 14);

  const [viewsRes, usersRes, plusRes, savedRes, postsRes] = await Promise.all([
    admin
      .from("view_events")
      .select("meme_id, session_hash, created_at")
      .gte("created_at", since.toISOString())
      .limit(50000),
    admin.from("profiles").select("id, created_at"),
    admin
      .from("billing_subscriptions")
      .select("user_id, status, current_period_end"),
    admin.from("saved_memes").select("meme_id", { count: "exact", head: true }),
    admin.from("community_posts").select("id", { count: "exact", head: true }),
  ]);

  // 일별 버킷 (KST 기준)
  const byDay = new Map<string, { views: number; sessions: Set<string> }>();
  const viewCountByMeme = new Map<string, number>();
  for (const row of viewsRes.data ?? []) {
    const day = seoulDate(new Date(row.created_at));
    const bucket = byDay.get(day) ?? { views: 0, sessions: new Set<string>() };
    bucket.views += 1;
    bucket.sessions.add(row.session_hash);
    byDay.set(day, bucket);
    viewCountByMeme.set(row.meme_id, (viewCountByMeme.get(row.meme_id) ?? 0) + 1);
  }

  const last14: DailyPoint[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = seoulDate(d);
    const b = byDay.get(key);
    last14.push({ date: key, views: b?.views ?? 0, sessions: b?.sessions.size ?? 0 });
  }

  const todayKey = seoulDate(new Date());
  const yKey = seoulDate(new Date(Date.now() - 86_400_000));
  const today = byDay.get(todayKey);
  const yesterday = byDay.get(yKey);

  // 인기 밈 — 최근 14일 조회 상위
  const topIds = [...viewCountByMeme.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  let topMemes: AdminStats["topMemes"] = [];
  if (topIds.length > 0) {
    const { data: memeRows } = await admin
      .from("memes")
      .select("id, title, short_id, slug")
      .in(
        "id",
        topIds.map(([id]) => id)
      );
    const byId = new Map((memeRows ?? []).map((m) => [m.id, m]));
    topMemes = topIds.flatMap(([id, views]) => {
      const m = byId.get(id);
      return m
        ? [{ id, title: m.title, shortId: m.short_id, slug: m.slug, views }]
        : [];
    });
  }

  const now = Date.now();
  const weekAgo = now - 7 * 86_400_000;
  const profiles = usersRes.data ?? [];

  return {
    today: { views: today?.views ?? 0, sessions: today?.sessions.size ?? 0 },
    yesterday: { views: yesterday?.views ?? 0, sessions: yesterday?.sessions.size ?? 0 },
    last14,
    totals: {
      users: profiles.length,
      newUsers7d: profiles.filter((p) => Date.parse(p.created_at) > weekAgo).length,
      plusActive: (plusRes.data ?? []).filter(
        (s) => s.status === "active" && Date.parse(s.current_period_end) > now
      ).length,
      savedMemes: savedRes.count ?? 0,
      communityPosts: postsRes.count ?? 0,
    },
    topMemes,
  };
}
