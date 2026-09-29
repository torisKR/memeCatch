import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { isDailySignalLocale } from "@/lib/plus-daily-signal-delivery.server";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson } from "@/lib/request-body";
import { hasTrustedOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStore() {
  return { "cache-control": "no-store" };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInput(value: unknown): { enabled: boolean; locale: string } | null {
  if (!isRecord(value) || typeof value.enabled !== "boolean" || typeof value.locale !== "string") {
    return null;
  }
  if (!isDailySignalLocale(value.locale)) return null;
  return { enabled: value.enabled, locale: value.locale };
}

function errorCode(message: string): string {
  if (message.includes("plus_required")) return "plus_required";
  if (message.includes("unsupported_locale")) return "unsupported_locale";
  if (message.includes("auth_required")) return "auth_required";
  return "preference_failed";
}

export async function GET(): Promise<Response> {
  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ signedIn: false, enabled: false, locale: "ko" }, { status: 401, headers: noStore() });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plus_digest_preferences")
    .select("enabled, locale, timezone")
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "preference_unavailable" }, { status: 500, headers: noStore() });
  }

  return NextResponse.json(
    {
      signedIn: true,
      plus: entitlement.isPremium,
      enabled: data?.enabled ?? false,
      locale: data?.locale && isDailySignalLocale(data.locale) ? data.locale : "ko",
      timezone: data?.timezone ?? "Asia/Seoul",
    },
    { status: 200, headers: noStore() },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: noStore() });
  }
  const input = parseInput(await readBoundedJson(request, 2 * 1024).catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: noStore() });
  }

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "signed_out" }, { status: 401, headers: noStore() });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_plus_digest_preferences", {
    p_enabled: input.enabled,
    p_locale: input.locale,
  });
  if (error) {
    const code = errorCode(error.message);
    return NextResponse.json({ error: code }, { status: code === "plus_required" ? 403 : 400, headers: noStore() });
  }

  const result = isRecord(data) ? data : {};
  return NextResponse.json(
    {
      ok: true,
      enabled: result.enabled === true,
      locale: typeof result.locale === "string" ? result.locale : input.locale,
      timezone: typeof result.timezone === "string" ? result.timezone : "Asia/Seoul",
    },
    { status: 200, headers: noStore() },
  );
}
