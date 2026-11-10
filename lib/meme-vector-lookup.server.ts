import { createHash } from "node:crypto";
import { createStaticClient } from "@/lib/supabase/server";
import { isMemeVector, MEME_VECTOR_PROFILE } from "@/lib/meme-vectors";
import { createEmbeddingAuthHeaders } from "@/lib/meme-embedding-auth.server";
import { hostedLoopbackForbidden } from "@/lib/meme-embedding-host";

const queryCache = new Map<string, { expires: number; vector: number[] }>();
const pendingQueries = new Map<string, Promise<number[] | null>>();

export function semanticSearchEnabled(env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  return env.MEME_SEMANTIC_SEARCH_ENABLED === "true";
}
export function embeddingEndpoint(env: Readonly<Record<string, string | undefined>> = process.env): URL | null {
  if (!semanticSearchEnabled(env)) return null;
  const onCloudflare = env.MEMECATCH_RUNTIME === "cloudflare";
  if (onCloudflare && (env.MEME_EMBEDDING_RUNTIME === "bundled" || !env.MEME_EMBEDDING_URL)) return null;
  const hosted = hostedLoopbackForbidden(env);
  const endpoint = env.MEME_EMBEDDING_RUNTIME === "bundled" && env.VERCEL_URL && !onCloudflare
    ? `https://${env.VERCEL_URL}/v1/embeddings` : env.MEME_EMBEDDING_URL;
  if (!endpoint) return null;
  try {
    const url = new URL(endpoint);
    if (env.MEME_EMBEDDING_RUNTIME === "bundled" && env.VERCEL_URL && !onCloudflare && url.host !== env.VERCEL_URL) return null;
    const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/v1/embeddings") return null;
    if (loopback && hosted) return null;
    if (url.protocol === "https:" || (url.protocol === "http:" && loopback && !hosted)) return url;
  } catch { /* Invalid configuration leaves lexical search available. */ }
  return null;
}
export async function embedMemeQuery(query: string): Promise<number[] | null> {
  const endpoint = embeddingEndpoint();
  if (!endpoint) return null;
  const input = `query: ${query.normalize("NFKC").trim()}`;
  const key = createHash("sha256").update(JSON.stringify([endpoint.href, process.env.MEME_EMBEDDING_RUNTIME, process.env.MEME_EMBEDDING_RUNTIME === "bundled" ? process.env.CRON_SECRET : process.env.MEME_EMBEDDING_API_KEY, MEME_VECTOR_PROFILE, input])).digest("hex");
  const cached = queryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    queryCache.delete(key);
    queryCache.set(key, cached);
    return [...cached.vector];
  }
  queryCache.delete(key);
  if (pendingQueries.has(key)) return pendingQueries.get(key)!;
  if (pendingQueries.size >= 16) return null;
  const operation = loadQueryEmbedding(endpoint, input).then((vector) => {
    if (vector) {
      queryCache.set(key, { expires: Date.now() + 300_000, vector: [...vector] });
      while (queryCache.size > 64) queryCache.delete(queryCache.keys().next().value!);
    }
    return vector;
  }).finally(() => pendingQueries.delete(key));
  pendingQueries.set(key, operation);
  return operation;
}

async function loadQueryEmbedding(endpoint: URL, input: string): Promise<number[] | null> {
  try {
    const bundled = process.env.MEME_EMBEDDING_RUNTIME === "bundled";
    const authHeaders = bundled ? createEmbeddingAuthHeaders(input) : {};
    if (!authHeaders) return null;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...authHeaders,
        ...(bundled && process.env.VERCEL_URL && endpoint.host === process.env.VERCEL_URL
          && process.env.VERCEL_AUTOMATION_BYPASS_SECRET
          ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}),
        ...(!bundled && process.env.MEME_EMBEDDING_API_KEY ? { authorization: `Bearer ${process.env.MEME_EMBEDDING_API_KEY}` } : {}),
      },
      body: JSON.stringify({ model: MEME_VECTOR_PROFILE, input }),
      redirect: "error", signal: AbortSignal.timeout(bundled ? 30_000 : 6_000), cache: "no-store",
    });
    if (!response.ok) return null;
    const result = await response.json();
    const vector: unknown = result?.data?.[0]?.embedding;
    return result?.model === MEME_VECTOR_PROFILE && isMemeVector(vector) ? vector : null;
  } catch { return null; }
}
export async function getSemanticRelatedMemeIds(memeId: string, limit = 9): Promise<string[]> {
  if (!semanticSearchEnabled()) return [];
  try {
    const { data, error } = await createStaticClient().rpc("related_meme_embeddings", {
      p_meme_id: memeId, p_limit: Math.min(40, Math.max(1, limit)),
    });
    return error || !data ? [] : data.map((row) => row.meme_id);
  } catch { return []; }
}
