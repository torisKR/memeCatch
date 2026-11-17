import { createPreviewDeadlineDb, withPreviewDeadline } from "@/lib/explore-preview-deadline.server";
import { hasTrustedOrigin } from "@/lib/origin";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";
import { qualifySearchPreviews } from "@/lib/search-preview.server";
import type { MemeListItem } from "@/lib/queries";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 24;

/** Re-read public content and its review ledger; never trust browser-supplied URLs. */
export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) return Response.json({ error: "untrusted origin" }, { status: 403 });
  const globalQuota = rateLimit("explore-previews:all", { limit: 1200, windowMs: 60_000 });
  if (!globalQuota.ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  const quota = rateLimit(`explore-previews:${getClientIp(request)}`, { limit: 120, windowMs: 60_000 });
  if (!quota.ok) return Response.json({ error: "rate_limited" }, { status: 429 });
  let body: unknown;
  try {
    body = await readBoundedJson(request, 2048);
  } catch (error) {
    return Response.json({ error: "invalid request" }, { status: error instanceof RequestBodyTooLargeError ? 413 : 400 });
  }
  const ids = body && typeof body === "object" ? (body as { ids?: unknown }).ids : null;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_IDS ||
      !ids.every((id) => typeof id === "string" && UUID.test(id))) {
    return Response.json({ error: "invalid ids" }, { status: 400 });
  }
  const result = await withPreviewDeadline(async (signal) => {
    const { data, error } = await createPreviewDeadlineDb("anon").from("memes").select(
      "id, meme_contents(type, thumbnail_url, is_representative, platform, url, content_id, availability, moderation_status, manual_video_verified)",
    ).in("id", [...new Set(ids)]).in("moderation_status", ["approved", "limited"]).abortSignal(signal);
    if (error || !Array.isArray(data)) throw new Error("catalog unavailable");
    const cards = data as unknown as MemeListItem[];
    let ledgerFailed = false;
    const previews = await qualifySearchPreviews(cards, {
      client: createPreviewDeadlineDb("service_role"), signal, onFailure: () => { ledgerFailed = true; },
    });
    if (ledgerFailed) throw new Error("ledger unavailable");
    return cards.map((card, index) => ({ id: card.id, contents: previews[index] ?? [] }));
  }, request.signal);
  if (!result) return Response.json({ error: "previews unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  return Response.json({ previews: result }, { headers: { "Cache-Control": "no-store" } });
}
