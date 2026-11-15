import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ error: "invalid_origin" }, { status: 403 });
  }
  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "signed_out" }, { status: 401 });
  }
  if (!entitlement.isPremium) {
    return NextResponse.json({ error: "not_premium" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_saved_context_alerts_read");
  if (error) {
    return NextResponse.json({ error: "mark_failed" }, { status: 500 });
  }

  return NextResponse.json(
    { ok: true, marked: data ?? 0 },
    { status: 200, headers: { "cache-control": "no-store" } },
  );
}
