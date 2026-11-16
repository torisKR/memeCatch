import { runSourceRefresh } from "@/lib/sources/refresh.server";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/db/cache-tags";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 출처 메타데이터 재확인 cron (deploy/scheduler/crontab에 등록).
 * 오래된 출처부터 공개·임베드 상태를 확인한다.
 * Bearer CRON_SECRET 인증 — trend-pulse와 동일 규약.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await runSourceRefresh();
  return Response.json(
    { ok: result.status === "ok", ...result },
    {
      status: result.status === "ok" ? 200 : 502,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

/** Expire cached catalog reads after an externally applied content correction. */
export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "REVALIDATION_FAILED" }, { status: 500 });
  }
}
