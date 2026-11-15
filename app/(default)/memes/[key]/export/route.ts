import { ImageResponse } from "next/og";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/server";
import {
  SAFETY_LEVELS,
  LIFECYCLE_STATUS,
  shortIdFromParam,
  type SafetyLevel,
  type LifecycleStatus,
} from "@/lib/labels";
import {
  CARD_FORMATS,
  isCardTemplate,
  isCardFormat,
  loadCardFonts,
  renderMemeCard,
} from "@/lib/meme-card";
import {
  hasRequiredTranslationFields,
  isTranslationCurrent,
  type MemeTranslationRow,
} from "@/lib/meme-translations";
import { isSeoContentLocale } from "@/lib/i18n-routing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExportQuotaClient = {
  rpc(name: "reserve_meme_export"): PromiseLike<{ error: { code?: string } | null }>;
};

type ExportTranslation = Pick<
  MemeTranslationRow,
  "meme_id" | "locale" | "status" | "title" | "summary" | "description" | "origin" | "source_updated_at"
>;

function errorResponse(error: string, status: number): Response {
  return NextResponse.json(
    { error },
    {
      status,
      headers: {
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    },
  );
}

/**
 * B2 — 밈 카드 이미지 내보내기.
 * 로그인 사용자 누구나 모든 템플릿·포맷을 1x + "catchmeme.com" 워터마크로 받는다.
 * 남용은 reserve_meme_export 쿼터가 막는다.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
): Promise<Response> {
  const { key } = await params;
  const shortId = shortIdFromParam(key);
  const sp = req.nextUrl.searchParams;
  const requestedLocale = sp.get("locale");
  if (requestedLocale !== null && !isSeoContentLocale(requestedLocale)) {
    return errorResponse("invalid_locale", 400);
  }
  const localizedLocale = isSeoContentLocale(requestedLocale) ? requestedLocale : null;

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return errorResponse("signed_out", 401);

  const { error: quotaError } = await (db as unknown as ExportQuotaClient).rpc(
    "reserve_meme_export",
  );
  if (quotaError) {
    const limited = quotaError.code === "P0429";
    return errorResponse(limited ? "rate_limited" : "quota_unavailable", limited ? 429 : 503);
  }

  // --- 옵션 파싱 ---
  const templateParam = sp.get("template");
  const formatParam = sp.get("format");
  const template = isCardTemplate(templateParam) ? templateParam : "classic";
  const format = isCardFormat(formatParam) ? formatParam : "card";

  // --- 데이터 로드 ---
  const { data: meme, error: memeError } = await db
    .from("memes")
    .select("id, title, summary, updated_at, safety_level, lifecycle_status")
    .eq("short_id", shortId)
    .in("moderation_status", ["approved", "limited"])
    .maybeSingle();
  if (memeError) return errorResponse("meme_unavailable", 503);
  if (!meme) return errorResponse("not_found", 404);

  let title = meme.title;
  let summary = meme.summary;
  if (localizedLocale) {
    const { data: translation, error: translationError } = await db
      .from("meme_translations")
      .select("meme_id, locale, status, title, summary, description, origin, source_updated_at")
      .eq("meme_id", meme.id)
      .eq("locale", localizedLocale)
      .eq("status", "reviewed")
      .maybeSingle()
      .overrideTypes<ExportTranslation, { merge: false }>();
    if (translationError) return errorResponse("translation_unavailable", 503);
    if (
      !translation ||
      !hasRequiredTranslationFields(translation) ||
      !isTranslationCurrent(translation.source_updated_at, meme.updated_at)
    ) {
      return errorResponse("localized_translation_unavailable", 404);
    }
    title = translation.title;
    summary = translation.summary;
  }

  const safetyLevel = meme.safety_level as SafetyLevel;
  const lifecycleStatus = meme.lifecycle_status as LifecycleStatus;
  // 라벨 맵에 없는 값 방어(잘못된 enum이 들어와도 500 방지).
  const safeLevel = safetyLevel in SAFETY_LEVELS ? safetyLevel : "yellow";
  const safeStatus = lifecycleStatus in LIFECYCLE_STATUS ? lifecycleStatus : "active";

  const fonts = await loadCardFonts();
  const { width, height } = CARD_FORMATS[format];

  const element = renderMemeCard(
    {
      title,
      summary,
      safetyLevel: safeLevel,
      lifecycleStatus: safeStatus,
    },
    {
      template,
      format,
      watermark: true,
      hasFont: fonts !== null,
      locale: localizedLocale ?? "ko",
    },
  );

  const filename = `memecatch-${shortId}-${template}-${format}.png`;

  return new ImageResponse(element, {
    width,
    height,
    fonts: fonts
      ? [
          { name: "Pretendard", data: fonts.bold, style: "normal" as const, weight: 700 as const },
          { name: "Pretendard", data: fonts.regular, style: "normal" as const, weight: 400 as const },
        ]
      : undefined,
    headers: {
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
      "content-language": localizedLocale ?? "ko",
      "vary": "Cookie",
      "x-content-type-options": "nosniff",
    },
  });
}
