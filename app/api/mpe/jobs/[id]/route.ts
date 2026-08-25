import { MPE_STORAGE_BUCKET } from "@/lib/mpe/storage.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const SIGNED_URL_SECONDS = 60;
const ARTIFACT_KEY = new RegExp("^[0-9a-f-]{36}/[0-9a-f-]{36}/renders/[0-9a-f]{64}\\.mp4$");

function safeOutput(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const output = { ...value as Record<string, unknown> };
  delete output.artifactKey;
  return output;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });

  const { id } = await params;
  const { data, error } = await supabase
    .from("processing_jobs")
    .select("id, ingestion_id, job_type, status, attempts, output_json, error_code, started_at, completed_at, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return Response.json({ ok: false, error: "job_not_found" }, { status: 404 });

  const output = safeOutput(data.output_json);
  let downloadUrl: string | null = null;
  if (data.job_type === "render" && data.status === "completed") {
    const artifactKey = typeof data.output_json === "object" && data.output_json !== null && !Array.isArray(data.output_json)
      ? (data.output_json as Record<string, unknown>).artifactKey
      : null;
    if (typeof artifactKey !== "string" || !ARTIFACT_KEY.test(artifactKey)) {
      return Response.json({ ok: false, error: "artifact_not_ready" }, { status: 502 });
    }
    const { data: signed, error: signError } = await createAdminClient().storage
      .from(MPE_STORAGE_BUCKET)
      .createSignedUrl(artifactKey, SIGNED_URL_SECONDS, { download: "memecatch-render.mp4" });
    if (signError || !signed?.signedUrl) {
      return Response.json({ ok: false, error: "artifact_not_ready" }, { status: 502 });
    }
    downloadUrl = signed.signedUrl;
  }

  return Response.json({
    ok: true,
    data: {
      id: data.id,
      ingestionId: data.ingestion_id,
      jobType: data.job_type,
      status: data.status,
      attempts: data.attempts,
      output,
      downloadUrl,
      downloadExpiresIn: downloadUrl ? SIGNED_URL_SECONDS : null,
      errorCode: data.error_code,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    },
  }, { headers: { "cache-control": "no-store" } });
}
