import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/origin";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/request-body";
import { searchMemeReferences } from "@/lib/meme-reference-search.server";

const schema = z.object({ query: z.string().trim().min(2).max(120), limit: z.number().int().min(1).max(20).default(12) });
const headers = { "cache-control": "no-store" };
export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  const limit = rateLimit(`meme-reference:${getClientIp(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ error: "rate_limited" }, { status: 429, headers: { ...headers, "retry-after": String(limit.retryAfterSec) } });
  const parsed = schema.safeParse(await readBoundedJson(request, 2048).catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_query" }, { status: 400, headers });
  try { return Response.json(await searchMemeReferences(parsed.data.query, parsed.data.limit), { headers }); }
  catch { return Response.json({ error: "search_unavailable" }, { status: 503, headers }); }
}
