import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson } from "@/lib/request-body";
import { hasTrustedOrigin } from "@/lib/origin";

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

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

const OUTCOME_LOCALES = new Set(["ko", "en", "ja", "zh", "zh-tw"]);
const OUTCOME_CHANNELS = new Set([
  "instagram",
  "tiktok",
  "youtube",
  "threads",
  "x",
  "community",
  "messaging",
  "blog",
  "other",
]);
const OUTCOME_ARTIFACT_KINDS = new Set(["caption", "single_card", "creator_pack", "link", "other"]);
const OUTCOME_MODES = new Set(["bulk", "one_cut"]);

type OutcomeInput = {
  memeId: string;
  locale: string;
  channel: string;
  artifactKind: string;
  mode: "bulk" | "one_cut";
  resultUrl: string | null;
  performanceNote: string | null;
  privateNote: string | null;
};

function optionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > maxLength ? undefined : normalized || null;
}

async function parseOutcomeInput(request: Request): Promise<OutcomeInput | null> {
  const body = await readBoundedJson(request, 8 * 1024).catch(() => null);
  if (!isRecord(body) || !isUuid(body.memeId)) return null;
  if (
    typeof body.locale !== "string" ||
    !OUTCOME_LOCALES.has(body.locale) ||
    typeof body.channel !== "string" ||
    !OUTCOME_CHANNELS.has(body.channel) ||
    typeof body.artifactKind !== "string" ||
    !OUTCOME_ARTIFACT_KINDS.has(body.artifactKind)
  ) {
    return null;
  }

  const mode = body.mode === undefined ? "bulk" : body.mode;
  if (typeof mode !== "string" || !OUTCOME_MODES.has(mode)) return null;
  if (mode !== "bulk" && mode !== "one_cut") return null;

  const resultUrl = optionalText(body.resultUrl, 2048);
  const performanceNote = optionalText(body.performanceNote, 1000);
  const privateNote = optionalText(body.privateNote, 1000);
  if (resultUrl === undefined || performanceNote === undefined || privateNote === undefined) return null;
  if (resultUrl !== null) {
    try {
      const parsed = new URL(resultUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    } catch {
      return null;
    }
  }
  if (mode === "one_cut" && resultUrl === null) return null;

  return {
    memeId: body.memeId,
    locale: body.locale,
    channel: body.channel,
    artifactKind: body.artifactKind,
    mode,
    resultUrl,
    performanceNote,
    privateNote,
  };
}

function errorCode(error: { message?: string } | null): string {
  const message = error?.message?.trim() ?? "";
  if (message.includes("auth_required")) return "auth_required";
  if (message.includes("plus_required")) return "plus_required";
  if (message.includes("receipt_conflict")) return "receipt_conflict";
  if (message.includes("invalid_meme")) return "invalid_meme";
  if (message.includes("invalid_locale")) return "invalid_locale";
  if (message.includes("locale_unavailable")) return "locale_unavailable";
  if (message.includes("invalid_channel")) return "invalid_channel";
  if (message.includes("invalid_artifact_kind")) return "invalid_artifact_kind";
  if (message.includes("invalid_mode")) return "invalid_mode";
  if (message.includes("meme_not_trusted_for_one_cut")) return "meme_not_trusted_for_one_cut";
  if (message.includes("invalid_result_url")) return "invalid_result_url";
  if (message.includes("performance_note_too_long")) return "invalid_note";
  if (message.includes("private_note_too_long")) return "invalid_note";
  if (message.includes("translation_missing")) return "locale_unavailable";
  if (message.includes("translation_machine")) return "locale_unavailable";
  if (message.includes("translation_stale")) return "locale_unavailable";
  return "completion_failed";
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: headers() });
  }
  const input = await parseOutcomeInput(request);
  if (!input) {
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
  const { data, error } = await supabase.rpc("record_plus_meme_use_receipt", {
    p_artifact_kind: input.artifactKind,
    p_channel: input.channel,
    p_locale: input.locale,
    p_meme_id: input.memeId,
    p_mode: input.mode,
    p_performance_note: input.performanceNote,
    p_private_note: input.privateNote,
    p_result_url: input.resultUrl,
  });
  if (error) {
    const code = errorCode(error);
    const status = code === "auth_required"
      ? 401
      : code === "plus_required"
        ? 403
        : code === "receipt_conflict"
          ? 409
        : code === "invalid_meme" || code === "meme_not_trusted_for_one_cut" || code.startsWith("invalid_")
          ? 400
          : code === "locale_unavailable"
            ? 422
            : 500;
    return NextResponse.json({ error: code }, { status, headers: headers() });
  }

  if (
    !isRecord(data) ||
    data.completed !== true ||
    typeof data.receipt_id !== "string" ||
    data.mode !== input.mode ||
    !nonNegativeInteger(data.completed_today_count) ||
    !nonNegativeInteger(data.current_streak)
  ) {
    return NextResponse.json({ error: "completion_failed" }, { status: 500, headers: headers() });
  }

  return NextResponse.json(
    {
      completed: true,
      alreadyCompleted: data.already_completed === true,
      alreadyRecorded: data.already_recorded === true,
      receiptId: data.receipt_id,
      mode: data.mode,
      completedTodayCount: data.completed_today_count,
      currentStreak: data.current_streak,
    },
    { status: 200, headers: headers() },
  );
}
