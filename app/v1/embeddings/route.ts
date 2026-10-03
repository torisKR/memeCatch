import { z } from "zod";
import { verifyEmbeddingAuth } from "@/lib/meme-embedding-auth.server";
import { embedBundledMemeInput } from "@/lib/meme-embedding-runtime.server";
import { isMemeVector, MEME_VECTOR_PROFILE } from "@/lib/meme-vectors";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readBoundedJson } from "@/lib/request-body";

export const runtime = "nodejs";
export const maxDuration = 60;

const queryPrefix = "query: ";
const schema = z.object({
  model: z.literal(MEME_VECTOR_PROFILE),
  input: z.string().max(queryPrefix.length + 120).refine((input) => {
    if (!input.startsWith(queryPrefix)) return false;
    const query = input.slice(queryPrefix.length);
    return query.length >= 2 && query.length <= 120
      && query === query.normalize("NFKC").trim();
  }),
}).strict();
const headers = { "cache-control": "no-store" };

export async function POST(request: Request): Promise<Response> {
  if (process.env.MEME_EMBEDDING_RUNTIME !== "bundled" || !process.env.CRON_SECRET?.trim()) {
    return Response.json({ error: "embedding_unavailable" }, { status: 503, headers });
  }

  const parsed = schema.safeParse(await readBoundedJson(request, 2048).catch(() => null));
  if (!parsed.success) return Response.json({ error: "invalid_request" }, { status: 400, headers });
  if (!verifyEmbeddingAuth(request, parsed.data.input)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  }

  const limit = rateLimit(`meme-embedding:${getClientIp(request)}`, { limit: 30, windowMs: 60_000 });
  if (!limit.ok) {
    return Response.json({ error: "rate_limited" }, {
      status: 429, headers: { ...headers, "retry-after": String(limit.retryAfterSec) },
    });
  }

  try {
    const embedding = await embedBundledMemeInput(parsed.data.input);
    if (isMemeVector(embedding)) {
      return Response.json({ model: MEME_VECTOR_PROFILE, data: [{ embedding, index: 0 }] }, { headers });
    }
  } catch { /* Keep model paths and internal failures out of responses. */ }
  return Response.json({ error: "embedding_unavailable" }, { status: 503, headers });
}
