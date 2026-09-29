import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { isSeoContentLocale, type SeoContentLocale } from "@/lib/i18n-routing";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson } from "@/lib/request-body";
import { hasTrustedOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TranslationPriorityStatus =
  | "none"
  | "requested"
  | "in_review"
  | "completed"
  | "dismissed"
  | "already_available"
  | "unavailable";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseInput(value: unknown): { memeId: string; locale: SeoContentLocale } | null {
  if (!isRecord(value)) return null;
  const memeId = value.memeId;
  const locale = value.locale;
  if (typeof memeId !== "string" || memeId.trim().length === 0 || memeId.length > 80) return null;
  if (typeof locale !== "string" || !isSeoContentLocale(locale)) return null;
  return { memeId: memeId.trim(), locale };
}

function errorCode(message: string): string {
  if (message.includes("auth_required")) return "auth_required";
  if (message.includes("plus_required")) return "plus_required";
  if (message.includes("saved_meme_required")) return "save_required";
  if (message.includes("too_many_translation_requests")) return "pending_limit";
  if (message.includes("invalid_locale")) return "invalid_locale";
  if (message.includes("public_meme_required")) return "meme_not_available";
  return "request_failed";
}

function noStore() {
  return { "cache-control": "no-store" };
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const input = parseInput({
    memeId: url.searchParams.get("memeId"),
    locale: url.searchParams.get("locale"),
  });
  if (!input) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: noStore() });
  }

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ locked: true, status: "none" }, { status: 200, headers: noStore() });
  }
  if (!entitlement.isPremium) {
    return NextResponse.json(
      { locked: true, status: "none" },
      { status: 200, headers: noStore() },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plus_translation_requests")
    .select("status, created_at, updated_at, completed_at")
    .eq("meme_id", input.memeId)
    .eq("locale", input.locale)
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { locked: false, status: "unavailable" as TranslationPriorityStatus },
      { status: 200, headers: noStore() },
    );
  }

  return NextResponse.json(
    {
      locked: false,
      status: data?.status ?? "none",
      createdAt: data?.created_at ?? null,
      updatedAt: data?.updated_at ?? null,
      completedAt: data?.completed_at ?? null,
    },
    { status: 200, headers: noStore() },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: noStore() });
  }
  const input = parseInput(await readBoundedJson(request, 4 * 1024).catch(() => null));
  if (!input) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: noStore() });
  }

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "signed_out" }, { status: 401, headers: noStore() });
  }
  if (!entitlement.isPremium) {
    return NextResponse.json({ error: "not_premium" }, { status: 403, headers: noStore() });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_plus_translation", {
    p_meme_id: input.memeId,
    p_locale: input.locale,
  });
  if (error) {
    const code = errorCode(error.message);
    const status = code === "save_required" ? 409 : code === "pending_limit" ? 429 : 400;
    return NextResponse.json({ error: code }, { status, headers: noStore() });
  }

  const response = isRecord(data) ? data : {};
  const resultStatus =
    response.status === "already_available"
      ? "already_available"
      : response.status === "already_requested"
        ? "requested"
        : "requested";
  return NextResponse.json(
    {
      ok: true,
      status: resultStatus,
      requestId:
        typeof response.requestId === "string"
          ? response.requestId
          : typeof response.request_id === "string"
            ? response.request_id
            : null,
    },
    { status: 200, headers: noStore() },
  );
}
