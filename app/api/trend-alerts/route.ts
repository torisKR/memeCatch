import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ALERTS = 30;

/**
 * A1 — Plus 트렌드 알림 인박스.
 * fan_out_trend_alerts(cron)가 적재한 trend_alerts를 사용자 스코프 RLS로 읽어
 * 관심 카테고리에서 라이징한 밈 목록을 반환한다.
 */
export async function GET(): Promise<Response> {
  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json(
      { locked: true, reason: "signed_out", alerts: [], unread: 0 },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }
  if (!entitlement.isPremium) {
    return NextResponse.json(
      { locked: true, reason: "not_premium", alerts: [], unread: 0 },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trend_alerts")
    .select(
      "id, kind, trend_score, read_at, created_at, memes(id, title, slug, short_id, category, trend_score)",
    )
    .order("created_at", { ascending: false })
    .limit(MAX_ALERTS);

  if (error) {
    return NextResponse.json(
      { error: "fetch_failed", alerts: [], unread: 0 },
      { status: 500, headers: { "cache-control": "no-store" } },
    );
  }

  const alerts = (data ?? []).filter((row) => row.memes !== null);
  const unread = alerts.filter((row) => row.read_at === null).length;

  return NextResponse.json(
    { locked: false, alerts, unread },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}

/**
 * 알림 읽음 처리 — mark_trend_alerts_read()는 auth.uid() 스코프에서만 동작(security definer).
 */
export async function POST(): Promise<Response> {
  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "signed_out" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_trend_alerts_read");
  if (error) {
    return NextResponse.json({ error: "mark_failed" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, marked: data ?? 0 },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
