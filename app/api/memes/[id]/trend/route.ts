import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { buildTrendChangeSummaries } from "@/lib/trend/change-summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plus 전용 밈 트렌드 추이.
 * 상세 페이지는 SSG로 유지해야 하므로(서버에서 구독을 읽으면 ISR이 깨짐)
 * 권한 검사와 데이터 제공을 이 동적 라우트로 분리한다.
 * 데이터 자체가 Plus 혜택이므로 비구독자에겐 시리즈를 보내지 않는다.
 */
const MAX_DAYS = 90;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json(
      { locked: true, reason: "signed_out" },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }
  if (!entitlement.isPremium) {
    return NextResponse.json(
      { locked: true, reason: "not_premium" },
      { status: 200, headers: { "cache-control": "no-store" } }
    );
  }

  const admin = createAdminClient();
  const { data: meme, error: memeError } = await admin
    .from("memes")
    .select("id")
    .eq("id", id)
    .in("moderation_status", ["approved", "limited"])
    .maybeSingle();
  if (memeError) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  if (!meme) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - MAX_DAYS);

  const { data, error } = await admin
    .from("meme_trend_metrics")
    .select("date, trend_score, views, reactions, comments, saves")
    .eq("meme_id", id)
    .gte("date", since.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  return NextResponse.json(
    {
      locked: false,
      series: data ?? [],
      summaries: buildTrendChangeSummaries(data ?? []),
    },
    { headers: { "cache-control": "no-store" } }
  );
}
