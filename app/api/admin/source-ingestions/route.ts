import { z } from "zod";
import { ingestSource, SourceIngestionError } from "@/lib/sources/ingest.server";
import { createClient } from "@/lib/supabase/server";

const inputSchema = z.object({
  url: z.string().trim().min(1).max(2_048),
  targetMemeId: z.uuid().optional(),
  retry: z.boolean().optional(),
});

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, error: "signed_out" }, { status: 401 });
  }

  const { data: isOperator } = await supabase.rpc("is_operator");
  if (!isOperator) {
    return Response.json({ ok: false, error: "operator_required" }, { status: 403 });
  }

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  if (parsed.data.retry !== true && parsed.data.retry !== undefined) {
    return Response.json({ ok: false, error: "invalid_retry" }, { status: 400 });
  }

  try {
    return Response.json(
      { ok: true, data: await ingestSource(parsed.data, user.id) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SourceIngestionError) {
      return Response.json(
        {
          ok: false,
          error: error.message,
          code: error.code,
          retryable: error.retryable,
          ...(error.nextRetryAt ? { nextRetryAt: error.nextRetryAt } : {}),
        },
        { status: error.status },
      );
    }
    return Response.json(
      { ok: false, error: "수집 기록을 저장하지 못했습니다.", code: "db_failure", retryable: true },
      { status: 503 },
    );
  }
}
