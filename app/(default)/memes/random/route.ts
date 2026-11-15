import { NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom } from "@/lib/labels";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/** 랜덤 밈 — 매 요청 무작위 1건으로 302 (Wave 1 세션 깊이). 캐시 금지 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createStaticClient();
    const { count } = await supabase
      .from("memes")
      .select("id", { count: "exact", head: true })
      .eq("moderation_status", "approved");
    if (!count) return NextResponse.redirect(`${SITE_URL}/explore`, 302);

    const offset = Math.floor(Math.random() * count);
    const { data } = await supabase
      .from("memes")
      .select("short_id, slug")
      .eq("moderation_status", "approved")
      .range(offset, offset)
      .single();
    if (!data) return NextResponse.redirect(`${SITE_URL}/explore`, 302);

    return NextResponse.redirect(
      `${SITE_URL}${memePathFrom(data.short_id, data.slug)}`,
      { status: 302, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.redirect(`${SITE_URL}/explore`, 302);
  }
}
