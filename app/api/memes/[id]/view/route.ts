import { createHmac } from "node:crypto";
import { signingSecret } from "@/lib/auth/signing-secret";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ViewRpc = {
  rpc(name: "record_meme_view", args: {
    p_meme_id: string;
    p_principal_hash: string;
  }): PromiseLike<{ error: unknown }>;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return Response.json({ ok: false, error: "origin_not_allowed" }, { status: 403 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }
  const ip = getClientIp(request);
  const limit = rateLimit(`meme-view:${ip}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return Response.json({ ok: false, error: "rate_limited" }, {
      status: 429,
      headers: { "retry-after": String(limit.retryAfterSec) },
    });
  }
  const secret = signingSecret();
  if (!secret) return Response.json({ ok: false, error: "unavailable" }, { status: 503 });
  const day = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const principal = createHmac("sha256", secret)
    .update(`${ip}\0${request.headers.get("user-agent") ?? ""}\0${day}`)
    .digest("hex");
  const { error } = await (createAdminClient() as unknown as ViewRpc).rpc("record_meme_view", {
    p_meme_id: id,
    p_principal_hash: principal,
  });
  return error
    ? Response.json({ ok: false, error: "view_not_recorded" }, { status: 400 })
    : Response.json({ ok: true }, { status: 202 });
}
