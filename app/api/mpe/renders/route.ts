import { z } from "zod";

import { rateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { readBoundedJson } from "@/lib/request-body";

const segmentSchema = z.object({
  startMs: z.number().int().min(0).max(21_600_000),
  endMs: z.number().int().positive().max(21_600_000),
  text: z.string().trim().min(1).max(500),
}).strict().refine((segment) => segment.endMs > segment.startMs, "invalid_segment_bounds");

const requestSchema = z.object({
  ingestionId: z.uuid(),
  preset: z.enum(["vertical", "square", "link"]),
  attribution: z.string().trim().min(1).max(500),
  segments: z.array(segmentSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  for (let index = 1; index < value.segments.length; index += 1) {
    if (value.segments[index].startMs < value.segments[index - 1].startMs) {
      context.addIssue({ code: "custom", path: ["segments", index, "startMs"], message: "segments_must_be_sorted" });
    }
  }
});

type RenderRpcClient = {
  rpc(name: "queue_metered_mpe_render_job", args: {
    p_ingestion_id: string;
    p_segments: Array<{ startMs: number; endMs: number; text: string }>;
    p_preset: "vertical" | "square" | "link";
    p_attribution: string;
  }): Promise<{
    data: { id: string; status: string } | null;
    error: { message: string } | null;
  }>;
};

export async function POST(request: Request): Promise<Response> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false, error: "signed_out" }, { status: 401 });

  const limit = rateLimit(`mpe-render:${user.id}`, { limit: 5, windowMs: 60_000 });
  if (!limit.ok) {
    return Response.json({ ok: false, error: "rate_limited" }, {
      status: 429,
      headers: { "retry-after": String(limit.retryAfterSec) },
    });
  }

  const payload = await readBoundedJson(request, 64 * 1024).catch(() => null);
  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) return Response.json({ ok: false, error: "invalid_render_request" }, { status: 400 });

  const { data, error } = await (supabase as unknown as RenderRpcClient).rpc("queue_metered_mpe_render_job", {
    p_ingestion_id: parsed.data.ingestionId,
    p_segments: parsed.data.segments,
    p_preset: parsed.data.preset,
    p_attribution: parsed.data.attribution,
  });
  if (error?.message.includes("api_rate_limited")) {
    return Response.json({ ok: false, error: "rate_limited" }, { status: 429 });
  }
  if (error || !data) return Response.json({ ok: false, error: "render_not_available" }, { status: 400 });

  return Response.json({
    ok: true,
    data: { jobId: data.id, status: data.status },
  }, { status: data.status === "queued" ? 202 : 200, headers: { "cache-control": "no-store" } });
}
