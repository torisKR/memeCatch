import { z } from "zod";
import {
  deleteTemporaryMedia,
  putTemporaryMedia,
  recordTemporaryCleanupFailure,
} from "@/lib/mpe/storage.server";
import { MediaValidationError, validateMedia, VIDEO_UPLOAD_LIMIT } from "@/lib/mpe/media";
import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { readBoundedFormData, RequestBodyTooLargeError } from "@/lib/request-body";
import { hasTrustedOrigin } from "@/lib/origin";

export const runtime = "nodejs";

const rightsSchema = z.object({ accepted: z.literal(true) });
type RpcClient = {
  rpc(name: "create_metered_media_ingestion", args: {
    p_source_id: string | null;
    p_ingest_mode: "USER_UPLOADED";
    p_mime_type: string;
    p_media_kind: "image" | "video";
    p_byte_size: number;
    p_sha256: string;
    p_temporary_storage_key: string;
    p_expires_at: string;
    p_rights_accepted: true;
    p_width: null;
    p_height: null;
    p_duration_ms: null;
  }): Promise<{
    data: Array<{ ingestion_id: string; job_ids: string[] }> | null;
    error: { message: string } | null;
  }>;
};

type QuotaRpcClient = {
  rpc(name: "reserve_api_request", args: { p_action: "mpe_upload_storage" }):
    Promise<{ error: { message: string } | null }>;
};

function parseRights(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try {
    return rightsSchema.safeParse(JSON.parse(value)).success ? true : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!hasTrustedOrigin(request)) {
    return Response.json({ ok: false, error: "invalid_origin" }, { status: 403 });
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });

  const limit = rateLimit(`mpe-upload:${user.id}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return Response.json({ ok: false, error: "rate_limited" }, {
      status: 429,
      headers: { "retry-after": String(limit.retryAfterSec) },
    });
  }

  const { error: quotaError } = await (supabase as unknown as QuotaRpcClient).rpc(
    "reserve_api_request",
    { p_action: "mpe_upload_storage" },
  );
  if (quotaError) {
    const limited = quotaError.message.includes("api_rate_limited");
    return Response.json(
      { ok: false, error: limited ? "rate_limited" : "rate_limit_unavailable" },
      { status: limited ? 429 : 503 },
    );
  }

  let form: FormData | null = null;
  try {
    form = await readBoundedFormData(request, VIDEO_UPLOAD_LIMIT + 128 * 1024);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json({ ok: false, error: "file_too_large" }, { status: 413 });
    }
  }
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "file_required" }, { status: 400 });
  if (!parseRights(form?.get("rightsDeclaration") ?? null)) {
    return Response.json({ ok: false, error: "rights_required" }, { status: 400 });
  }
  if (file.size > VIDEO_UPLOAD_LIMIT) {
    return Response.json({ ok: false, error: "file_too_large" }, { status: 413 });
  }
  if (form?.has("sourceId")) {
    return Response.json({ ok: false, error: "source_not_allowed" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let media;
  try {
    media = validateMedia(bytes, file.type);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return Response.json({ ok: false, error: error.code }, {
        status: error.code === "file_too_large" ? 413 : 400,
      });
    }
    throw error;
  }

  const storageKey = `${user.id}/${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
  try {
    await putTemporaryMedia(storageKey, bytes.buffer, media.mimeType);
  } catch {
    return Response.json({ ok: false, error: "upload_failed" }, { status: 502 });
  }

  const { data, error } = await (supabase as unknown as RpcClient).rpc("create_metered_media_ingestion", {
    p_source_id: null,
    p_ingest_mode: "USER_UPLOADED",
    p_mime_type: media.mimeType,
    p_media_kind: media.mimeType.startsWith("image/") ? "image" : "video",
    p_byte_size: media.size,
    p_sha256: media.sha256,
    p_temporary_storage_key: storageKey,
    p_expires_at: expiresAt,
    p_rights_accepted: true,
    p_width: null,
    p_height: null,
    p_duration_ms: null,
  });
  const created = data?.[0];
  if (error || !created) {
    try {
      await deleteTemporaryMedia(storageKey);
    } catch {
      await recordTemporaryCleanupFailure(storageKey, user.id).catch(() => undefined);
      return Response.json({ ok: false, error: "ingestion_failed_cleanup_failed" }, { status: 500 });
    }
    if (error?.message.includes("api_rate_limited")) {
      return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }
    return Response.json({ ok: false, error: "ingestion_failed" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    data: { ingestionId: created.ingestion_id, jobIds: created.job_ids, status: "queued" },
  }, { status: 201, headers: { "cache-control": "no-store" } });
}
