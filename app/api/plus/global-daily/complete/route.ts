import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { isGlobalDailyLocale, type GlobalDailyLocale } from "@/lib/global-daily-challenge";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function headers() {
  return {
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseLocale(request: Request): Promise<GlobalDailyLocale | null> {
  const body = await readBoundedJson(request, 2 * 1024).catch(() => null);
  if (!isRecord(body) || typeof body.locale !== "string" || !isGlobalDailyLocale(body.locale)) {
    return null;
  }
  return body.locale;
}

function errorCode(error: { message?: string } | null) {
  const message = error?.message?.trim() ?? "";
  if (message.includes("auth_required")) return "auth_required";
  if (message.includes("plus_required")) return "plus_required";
  if (message.includes("unsupported_locale")) return "unsupported_locale";
  if (message.includes("daily_not_available")) return "daily_not_available";
  return "completion_failed";
}

export async function POST(request: Request): Promise<Response> {
  const locale = await parseLocale(request);
  if (!locale) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: headers() });
  }

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "signed_out" }, { status: 401, headers: headers() });
  }
  if (!entitlement.isPremium) {
    return NextResponse.json({ error: "plus_required" }, { status: 403, headers: headers() });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_plus_global_daily_challenge", {
    p_locale: locale,
  });
  if (error) {
    const code = errorCode(error);
    const status = code === "auth_required" ? 401 : code === "plus_required" ? 403 : code === "daily_not_available" ? 409 : code === "unsupported_locale" ? 400 : 500;
    return NextResponse.json({ error: code }, { status, headers: headers() });
  }

  const result = isRecord(data) ? data : {};
  const currentStreak = Number(result.current_streak);
  if (result.completed !== true || !Number.isInteger(currentStreak) || currentStreak < 1) {
    return NextResponse.json({ error: "completion_failed" }, { status: 500, headers: headers() });
  }

  return NextResponse.json(
    {
      completed: true,
      alreadyCompleted: result.already_completed === true,
      challengeDate: typeof result.challenge_date === "string" ? result.challenge_date : null,
      locale: typeof result.locale === "string" ? result.locale : locale,
      currentStreak,
    },
    { status: 200, headers: { ...headers(), "content-language": locale } },
  );
}
