import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBoundedBytes, RequestBodyTooLargeError } from "@/lib/request-body";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 4 * 1024;
const MAX_CLOCK_SKEW_SECONDS = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ARTIFACT_HASH = /^[0-9a-f]{64}$/;
const SIGNATURE = /^[0-9a-f]{64}$/;
const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

type PublicationProof = {
  artifact_hash: string;
  production_id: string;
  site_linked_at: string | null;
  status: string;
  production: { meme_id: string } | Array<{ meme_id: string }> | null;
};
type ServiceReader = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): PromiseLike<{ data: PublicationProof | null; error: unknown }>;
      };
    };
  };
};

function failure(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

function configuredSecret(): Buffer | null {
  const value = process.env.VIDEO_WORKER_WEBHOOK_SECRET;
  if (!value || /[\r\n\0]/.test(value)) return null;
  const secret = Buffer.from(value, "utf8");
  return secret.length >= 32 ? secret : null;
}

function verifiedTimestamp(request: Request): string | null {
  const value = request.headers.get("x-video-worker-timestamp");
  if (!value || !/^\d{10,13}$/.test(value)) return null;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || Math.abs(Math.floor(Date.now() / 1000) - seconds) > MAX_CLOCK_SKEW_SECONDS) return null;
  return value;
}

function authenticSignature(request: Request, timestamp: string, body: Uint8Array, secret: Buffer): boolean {
  const supplied = request.headers.get("x-video-worker-signature") ?? "";
  if (!SIGNATURE.test(supplied)) return false;
  const expected = createHmac("sha256", secret).update(timestamp).update(".").update(body).digest();
  const actual = Buffer.from(supplied, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parsePayload(bytes: Uint8Array): { publicationId: string; artifactHash: string } | null {
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return null; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (Object.keys(record).length !== 2 ||
      typeof record.publicationId !== "string" || !UUID.test(record.publicationId) ||
      typeof record.artifactHash !== "string" || !ARTIFACT_HASH.test(record.artifactHash)) return null;
  return { publicationId: record.publicationId, artifactHash: record.artifactHash };
}

function validProof(row: PublicationProof, artifactHash: string): boolean {
  const production = Array.isArray(row.production) ? row.production[0] : row.production;
  if (!production || !UUID.test(production.meme_id) || row.artifact_hash !== artifactHash) return false;
  if (row.status === "site_linked") return typeof row.site_linked_at === "string" && row.site_linked_at.length > 0;
  if (row.status === "unavailable" || row.status === "blocked") return row.site_linked_at === null;
  return false;
}

export async function POST(request: Request): Promise<Response> {
  const secret = configuredSecret();
  if (!secret) return failure("worker_sync_not_configured", 503);
  const timestamp = verifiedTimestamp(request);
  if (!timestamp) return failure("invalid_worker_signature", 401);
  let body: Uint8Array;
  try { body = await readBoundedBytes(request, MAX_BODY_BYTES); }
  catch (error) {
    return failure(error instanceof RequestBodyTooLargeError ? "body_too_large" : "invalid_request", error instanceof RequestBodyTooLargeError ? 413 : 400);
  }
  if (!authenticSignature(request, timestamp, body, secret)) return failure("invalid_worker_signature", 401);
  const payload = parsePayload(body);
  if (!payload) return failure("invalid_request", 400);

  const service = createAdminClient() as unknown as ServiceReader;
  const { data, error } = await service.from("youtube_publications")
    .select("artifact_hash,production_id,site_linked_at,status,production:video_productions!inner(meme_id)")
    .eq("id", payload.publicationId)
    .maybeSingle();
  if (error) return failure("worker_sync_unavailable", 503);
  if (!data || !validProof(data, payload.artifactHash)) return failure("publication_state_mismatch", 409);

  // This callback is deliberately cache-only. Replaying a valid delivery repeats
  // the same invalidations and never mutates publication or meme state.
  revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
  revalidatePath("/(default)/memes/[key]", "page");
  revalidatePath("/[locale]/memes/[key]", "page");
  return Response.json({ revalidated: true }, { headers });
}
