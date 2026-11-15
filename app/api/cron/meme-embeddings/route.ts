import { createHash, timingSafeEqual } from "node:crypto";
import { signingSecret } from "@/lib/auth/signing-secret";
import {
  runMemeEmbeddingReindex,
  type MemeEmbeddingReindexResult,
} from "@/lib/meme-embedding-reindex.server";
import { embedBundledMemePassage } from "@/lib/meme-embedding-runtime.server";
import { MEME_VECTOR_DIMENSIONS, MEME_VECTOR_PROFILE } from "@/lib/meme-vectors";
import { readBoundedText } from "@/lib/request-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const headers = { "cache-control": "no-store" };
const MODEL_PROBE_MAX_BYTES = 128;
const probeSeed = "운영 배포의 동일 모델 메모리와 긴 문서 절단 경계를 확인합니다. ";
const modelProbeDocument = probeSeed.repeat(Math.ceil(6_900 / probeSeed.length)).slice(0, 6_900);

function hasExactBearer(request: Request, secret: string | undefined): boolean {
  const configured = secret?.trim();
  if (!configured) return false;
  const actual = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${configured}`;
  return timingSafeEqual(
    createHash("sha256").update(actual, "utf8").digest(),
    createHash("sha256").update(expected, "utf8").digest(),
  );
}

function hasNoQueryInput(request: Request): boolean {
  return new URL(request.url).search === "";
}

function responseFor(result: MemeEmbeddingReindexResult): Response {
  return Response.json(
    { ok: result.status !== "failed", ...result },
    {
      status: result.status === "failed" ? 503 : result.status === "deferred" ? 202 : 200,
      headers,
    },
  );
}

async function runManualReindex(request: Request, secret: string | undefined): Promise<Response> {
  if (!hasExactBearer(request, secret)) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers });
  }
  if (!hasNoQueryInput(request) || request.body !== null) {
    return Response.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400, headers });
  }
  if (process.env.MEME_EMBEDDING_REINDEX_ENABLED !== "true") {
    return Response.json({ ok: true, status: "disabled" }, { status: 202, headers });
  }
  return responseFor(await runMemeEmbeddingReindex());
}

async function probeModel(): Promise<Response> {
  const startedAt = performance.now();
  const vector = await embedBundledMemePassage(modelProbeDocument).catch(() => null);
  if (!vector) {
    return Response.json({ error: "model_unavailable" }, { status: 503, headers });
  }
  const memory = process.memoryUsage();
  const resources = process.resourceUsage();
  return Response.json({
    profile: MEME_VECTOR_PROFILE,
    dimensions: MEME_VECTOR_DIMENSIONS,
    elapsed_ms: Math.max(0, Math.round(performance.now() - startedAt)),
    rss_bytes: memory.rss,
    peak_rss_bytes: resources.maxRSS * 1_024,
    heap_used_bytes: memory.heapUsed,
    platform: process.platform,
  }, { headers });
}

async function postMode(request: Request): Promise<"reindex" | "probe" | null> {
  if (!hasNoQueryInput(request)) return null;
  let text: string;
  try {
    text = await readBoundedText(request, MODEL_PROBE_MAX_BYTES);
  } catch {
    return null;
  }
  if (text.length === 0) return "reindex";
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    return Object.keys(row).length === 1 && row.validate_model === true ? "probe" : null;
  } catch {
    return null;
  }
}

/** Vercel Cron uses the existing CRON_SECRET bearer credential. */
export async function GET(request: Request): Promise<Response> {
  return runManualReindex(request, process.env.CRON_SECRET);
}

/** Explicit operator QA/reindex runs use MEMECATCH_SIGNING_SECRET. */
export async function POST(request: Request): Promise<Response> {
  if (!hasExactBearer(request, signingSecret() ?? undefined)) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401, headers });
  }
  const mode = await postMode(request);
  if (!mode) return Response.json({ ok: false, error: "INVALID_REQUEST" }, { status: 400, headers });
  return mode === "probe" ? probeModel() : responseFor(await runMemeEmbeddingReindex());
}
