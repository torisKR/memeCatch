import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson } from "@/lib/request-body";
import { hasTrustedOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATINGS = new Set(["hit", "neutral", "miss"]);

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

async function parseInput(
  request: Request,
): Promise<{ receiptId: string; performanceRating: "hit" | "neutral" | "miss" } | null> {
  const body = await readBoundedJson(request, 2 * 1024).catch(() => null);
  if (
    !isRecord(body) ||
    !isUuid(body.receiptId) ||
    typeof body.performanceRating !== "string" ||
    !RATINGS.has(body.performanceRating)
  ) {
    return null;
  }

  return {
    receiptId: body.receiptId,
    performanceRating: body.performanceRating as "hit" | "neutral" | "miss",
  };
}

function errorCode(error: { message?: string } | null): string {
  const message = error?.message?.trim() ?? "";
  if (message.includes("auth_required")) return "auth_required";
  if (message.includes("plus_required")) return "plus_required";
  if (message.includes("rating_required")) return "rating_required";
  if (message.includes("invalid_rating")) return "invalid_rating";
  if (message.includes("receipt_not_found")) return "receipt_not_found";
  if (message.includes("rating_already_recorded")) return "rating_already_recorded";
  return "rating_update_failed";
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403, headers: responseHeaders() });
  }
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
  const { data, error } = await supabase.rpc("record_plus_meme_use_rating", {
    p_performance_rating: input.performanceRating,
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
          : code === "rating_already_recorded"
            ? 409
            : code === "rating_required" || code === "invalid_rating"
              ? 400
              : 500;
    return NextResponse.json({ error: code }, { status, headers: responseHeaders() });
  }

  if (
    !isRecord(data) ||
    data.updated !== true ||
    data.receipt_id !== input.receiptId ||
    data.performance_rating !== input.performanceRating
  ) {
    return NextResponse.json(
      { error: "rating_update_failed" },
      { status: 500, headers: responseHeaders() },
    );
  }

  return NextResponse.json(
    {
      updated: true,
      receiptId: input.receiptId,
      performanceRating: input.performanceRating,
    },
    { status: 200, headers: responseHeaders() },
  );
}
