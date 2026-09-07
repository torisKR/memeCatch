import { NextResponse } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";
import { memePathFrom } from "@/lib/labels";

/**
 * 랜덤 밈 경로를 JSON으로 반환 — 헤더 RandomMemeButton의 인터랙티브 "밈 찾는 중" 오버레이용.
 * 서버 302 라우트(/memes/random)는 직접 접근·SEO·공유용으로 유지하고,
 * 클라이언트는 이 엔드포인트로 목적지 경로만 받아 오버레이를 띄운 채 router.push 한다.
 * 매 요청 무작위 1건이므로 캐시 금지.
 */
export const dynamic = "force-dynamic";

const SHORT_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomShortId(): string {
  return Array.from({ length: 8 }, () =>
    SHORT_ID_ALPHABET[Math.floor(Math.random() * SHORT_ID_ALPHABET.length)]
  ).join("");
}

export async function GET() {
  const fallback = "/explore";
  try {
    const supabase = createStaticClient();
    const pivot = randomShortId();
    let { data } = await supabase
      .from("memes")
      .select("short_id, slug")
      .eq("moderation_status", "approved")
      .gte("short_id", pivot)
      .order("short_id", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data) {
      const wrapped = await supabase
        .from("memes")
        .select("short_id, slug")
        .eq("moderation_status", "approved")
        .lt("short_id", pivot)
        .order("short_id", { ascending: true })
        .limit(1)
        .maybeSingle();
      data = wrapped.data;
    }
    if (!data) return NextResponse.json({ path: fallback }, { headers: { "Cache-Control": "no-store" } });

    return NextResponse.json(
      { path: memePathFrom(data.short_id, data.slug) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ path: fallback }, { headers: { "Cache-Control": "no-store" } });
  }
}
