import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { createStaticClient } from "@/lib/supabase/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import {
  SAFETY_LEVELS,
  LIFECYCLE_STATUS,
  shortIdFromParam,
  type SafetyLevel,
  type LifecycleStatus,
} from "@/lib/labels";
import {
  CARD_TEMPLATES,
  CARD_FORMATS,
  isCardTemplate,
  isCardFormat,
  loadCardFonts,
  renderMemeCard,
} from "@/lib/meme-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PREMIUM_SCALE = 3;

/**
 * B2 — 밈 카드 이미지 내보내기.
 * 무료: classic 템플릿 + card 포맷 + 1x + "catchmeme.com" 워터마크.
 * Plus: 모든 템플릿·포맷 + 최대 3x 고해상도 + 워터마크 제거.
 *
 * 서버가 엔타이틀먼트를 최종 판정한다(클라이언트 UI 게이팅과 별개로 위조 방지).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await params;
  const shortId = shortIdFromParam(key);
  const sp = req.nextUrl.searchParams;

  const { isPremium } = await getPremiumEntitlement();

  // --- 옵션 파싱 + 엔타이틀먼트 게이팅 ---
  const templateParam = sp.get("template");
  const formatParam = sp.get("format");
  const template = isCardTemplate(templateParam) ? templateParam : "classic";
  const format = isCardFormat(formatParam) ? formatParam : "card";

  // 프리미엄 전용 옵션을 무료 사용자가 요청하면 402(업그레이드 유도).
  const wantsPremiumTemplate = CARD_TEMPLATES[template].premium;
  const wantsPremiumFormat = CARD_FORMATS[format].premium;
  const requestedScale = Number(sp.get("scale") ?? "1");
  const wantsHighRes = Number.isFinite(requestedScale) && requestedScale > 1;

  if (!isPremium && (wantsPremiumTemplate || wantsPremiumFormat || wantsHighRes)) {
    return NextResponse.json(
      { error: "premium_required" },
      { status: 402, headers: { "cache-control": "no-store" } },
    );
  }

  const scale = isPremium
    ? Math.min(Math.max(Math.round(requestedScale) || 1, 1), MAX_PREMIUM_SCALE)
    : 1;
  const watermark = !isPremium;

  // --- 데이터 로드 ---
  const supabase = createStaticClient();
  const { data: meme } = await supabase
    .from("memes")
    .select("title, summary, safety_level, lifecycle_status")
    .eq("short_id", shortId)
    .maybeSingle();

  const safetyLevel = (meme?.safety_level ?? "yellow") as SafetyLevel;
  const lifecycleStatus = (meme?.lifecycle_status ?? "active") as LifecycleStatus;
  // 라벨 맵에 없는 값 방어(잘못된 enum이 들어와도 500 방지).
  const safeLevel = safetyLevel in SAFETY_LEVELS ? safetyLevel : "yellow";
  const safeStatus = lifecycleStatus in LIFECYCLE_STATUS ? lifecycleStatus : "active";

  const fonts = await loadCardFonts();
  const { width, height } = CARD_FORMATS[format];

  const element = renderMemeCard(
    {
      title: meme?.title ?? "밈캐치",
      summary: meme?.summary ?? "그 밈, 3초 안에 알려드려요",
      safetyLevel: safeLevel,
      lifecycleStatus: safeStatus,
    },
    { template, format, watermark, hasFont: fonts !== null },
  );

  const filename = `memecatch-${shortId}-${template}-${format}${scale > 1 ? `@${scale}x` : ""}.png`;

  return new ImageResponse(element, {
    width: width * scale,
    height: height * scale,
    fonts: fonts
      ? [
          { name: "Pretendard", data: fonts.bold, style: "normal" as const, weight: 700 as const },
          { name: "Pretendard", data: fonts.regular, style: "normal" as const, weight: 400 as const },
        ]
      : undefined,
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
