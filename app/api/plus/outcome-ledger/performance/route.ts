import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseHeaders() {
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

async function parseInput(request: Request): Promise<{ receiptId: string; performanceNote: string } | null> {
  const body = await request.json().catch(() => null);
  if (!isRecord(body) || !isUuid(body.receiptId) || typeof body.performanceNote !== "string") {
    return null;
  }

  const performanceNote = body.performanceNote.trim();
  if (!performanceNote || performanceNote.length > 1000) return null;
  return { receiptId: body.receiptId, performanceNote };
}

function errorCode(error: { message?: string } | null): string {
  const message = error?.message?.trim() ?? "";
  if (message.includes("auth_required")) return "auth_required";
  if (message.includes("plus_required")) return "plus_required";
  if (message.includes("performance_note_required")) return "performance_note_required";
  if (message.includes("performance_note_too_long")) return "performance_note_too_long";
  if (message.includes("receipt_not_found")) return "receipt_not_found";
  if (message.includes("performance_already_recorded")) return "performance_already_recorded";
  return "performance_update_failed";
}

export async function POST(request: Request): Promise<Response> {
  const input = await parseInput(request);
  if (!input) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: responseHeaders() });
  }

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "signed_out" }, { status: 401, headers: responseHeaders() });
  }
  if (!entitlement.isPremium) {
    return NextResponse.json({ error: "plus_required" }, { status: 403, headers: responseHeaders() });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_plus_meme_use_performance", {
    p_performance_note: input.performanceNote,
    p_receipt_id: input.receiptId,
  });
  if (error) {
    const code = errorCode(error);
    const status = code === "auth_required"
      ? 401
      : code === "plus_required"
        ? 403
        : code === "receipt_not_found"
          ? 404
          : code === "performance_already_recorded"
            ? 409
            : code === "performance_note_required" || code === "performance_note_too_long"
              ? 400
              : 500;
    return NextResponse.json({ error: code }, { status, headers: responseHeaders() });
  }

  if (
    !isRecord(data) ||
    data.updated !== true ||
    data.receipt_id !== input.receiptId ||
    data.performance_note !== input.performanceNote
  ) {
    return NextResponse.json(
      { error: "performance_update_failed" },
      { status: 500, headers: responseHeaders() },
    );
  }

  return NextResponse.json(
    {
      updated: true,
      receiptId: input.receiptId,
      performanceNote: input.performanceNote,
    },
    { status: 200, headers: responseHeaders() },
  );
}
