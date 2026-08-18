import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RpcResult = PromiseLike<{ data: unknown; error: { message: string } | null }>;
type Rpc = (name: string, args?: Record<string, unknown>) => RpcResult;

function noStore() {
  return { "cache-control": "no-store" };
}

function rpcFor(client: Awaited<ReturnType<typeof createClient>>): Rpc {
  return client.rpc.bind(client) as unknown as Rpc;
}

function subscription(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = input.keys;
  if (
    typeof input.endpoint !== "string" ||
    typeof keys !== "object" || keys === null || Array.isArray(keys)
  ) return null;
  const keyRecord = keys as Record<string, unknown>;
  if (typeof keyRecord.p256dh !== "string" || typeof keyRecord.auth !== "string") return null;
  return { endpoint: input.endpoint, p256dh: keyRecord.p256dh, auth: keyRecord.auth };
}

export async function GET(): Promise<Response> {
  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json(
      { signedIn: false, plus: false, enabled: false, publicKey: "" },
      { status: 401, headers: noStore() },
    );
  }
  const client = await createClient();
  const { data, error } = await rpcFor(client)("has_web_push_subscription");
  if (error) return NextResponse.json({ error: "subscription_unavailable" }, { status: 500, headers: noStore() });
  return NextResponse.json({
    signedIn: true,
    plus: entitlement.isPremium,
    enabled: data === true,
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  }, { headers: noStore() });
}

export async function POST(request: Request): Promise<Response> {
  const input = subscription(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "invalid_subscription" }, { status: 400, headers: noStore() });

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) return NextResponse.json({ error: "signed_out" }, { status: 401, headers: noStore() });
  if (!entitlement.isPremium) return NextResponse.json({ error: "not_premium" }, { status: 403, headers: noStore() });

  const client = await createClient();
  const { error } = await rpcFor(client)("set_web_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_user_agent: request.headers.get("user-agent"),
  });
  if (error) return NextResponse.json({ error: "subscribe_failed" }, { status: 400, headers: noStore() });
  return NextResponse.json({ ok: true, enabled: true }, { headers: noStore() });
}

export async function DELETE(request: Request): Promise<Response> {
  const value = await request.json().catch(() => null);
  const endpoint = typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>).endpoint
    : null;
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400, headers: noStore() });
  }

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) return NextResponse.json({ error: "signed_out" }, { status: 401, headers: noStore() });
  const client = await createClient();
  const { error } = await rpcFor(client)("remove_web_push_subscription", { p_endpoint: endpoint });
  if (error) return NextResponse.json({ error: "unsubscribe_failed" }, { status: 400, headers: noStore() });
  return NextResponse.json({ ok: true, enabled: false }, { headers: noStore() });
}
