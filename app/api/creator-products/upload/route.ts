import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { readBoundedFormData, RequestBodyTooLargeError } from "@/lib/request-body";
import { MediaValidationError, validateMedia } from "@/lib/mpe/media";
import { hasTrustedOrigin } from "@/lib/origin";
import {
  CreatorProductRasterError,
  inspectCreatorProductRaster,
} from "@/lib/creator-products/raster";

export const runtime = "nodejs";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_STORAGE_OBJECTS = 20;
const STORAGE_LIST_LIMIT = MAX_STORAGE_OBJECTS + 1;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
};
type QuotaClient = {
  rpc(name: "reserve_creator_product_upload"): Promise<{ error: { message: string } | null }>;
};

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "login_required" }, { status: 401 });
  const limit = rateLimit(`creator-product-upload:${user.id}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) return Response.json({ ok: false, error: "rate_limited" }, {
    status: 429, headers: { "retry-after": String(limit.retryAfterSec) },
  });
  const { error: quotaError } = await (supabase as unknown as QuotaClient).rpc(
    "reserve_creator_product_upload",
  );
  if (quotaError) {
    const limited = quotaError.message.includes("api_rate_limited");
    return Response.json({ ok: false, error: limited ? "rate_limited" : "rate_limit_unavailable" }, { status: limited ? 429 : 503 });
  }

  let form: FormData | null = null;
  try {
    form = await readBoundedFormData(request, MAX_BYTES + 128 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return Response.json({ ok: false, error: "too_large" }, { status: 413 });
  }
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "file_required" }, { status: 400 });
  const extension = EXTENSIONS[file.type];
  if (!extension || file.size < 1 || file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: "invalid_image" }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const validated = validateMedia(bytes, file.type);
    if (!validated.mimeType.startsWith("image/") || validated.size > MAX_BYTES) throw new MediaValidationError("file_too_large");
    inspectCreatorProductRaster(bytes, validated.mimeType);
  } catch (error) {
    if (error instanceof MediaValidationError || error instanceof CreatorProductRasterError) {
      return Response.json({ ok: false, error: "invalid_image" }, { status: 400 });
    }
    throw error;
  }

  const storage = createAdminClient().storage.from("creator-products");
  let objectCount: number;
  try {
    const { data, error } = await storage.list(user.id, {
      limit: STORAGE_LIST_LIMIT,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data) {
      return Response.json({ ok: false, error: "storage_quota_unavailable" }, { status: 503 });
    }
    objectCount = data.length;
  } catch {
    return Response.json({ ok: false, error: "storage_quota_unavailable" }, { status: 503 });
  }
  if (objectCount >= MAX_STORAGE_OBJECTS) {
    return Response.json({ ok: false, error: "storage_quota_exceeded" }, { status: 429 });
  }

  // This bounded preflight limits durable objects but is not an atomic reservation:
  // concurrent accepted uploads can cross the cap. This endpoint also does not clean up
  // objects orphaned by later product-form failures.
  const objectPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
  try {
    const { data, error } = await storage.upload(objectPath, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (error || !data) return Response.json({ ok: false, error: "upload_failed" }, { status: 502 });
    return Response.json({ ok: true, path: `creator-products/${data.path}` }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "upload_failed" }, { status: 502 });
  }
}
