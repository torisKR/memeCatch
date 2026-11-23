import { revalidateTag } from "next/cache";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/db/cache-tags";
import { expireInstagramVideoVerificationCache } from "@/lib/instagram-video-verification-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cache expiry for routes the Axum server answers (docs/axum-migration/PLAN.md).
 * Next's Data Cache can only be expired from inside Next, so after doing the
 * work a Next route would have followed with revalidateTag or revalidatePath,
 * Axum asks for the same expiry here. Only these fixed scopes exist: a caller
 * cannot name a tag or a path.
 * Bearer CRON_SECRET, as the cron routes.
 */
const SCOPES: Record<string, () => void> = {
  "public-catalog": () => revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 }),
  "instagram-video-verification": expireInstagramVideoVerificationCache,
};

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  const scope = new URL(request.url).searchParams.get("scope") ?? "";
  const expire = Object.hasOwn(SCOPES, scope) ? SCOPES[scope] : undefined;
  if (!expire) {
    return Response.json({ ok: false, error: "UNKNOWN_SCOPE" }, { status: 400 });
  }
  try {
    expire();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "REVALIDATION_FAILED" }, { status: 500 });
  }
}
