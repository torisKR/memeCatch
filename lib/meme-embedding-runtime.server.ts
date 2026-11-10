import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import { externalEmbeddingRuntimeConfigured } from "@/lib/meme-embedding-host";
import { loadEmbeddingPipeline } from "@/lib/meme-embedding-pipeline.server";
import { isMemeVector, MEME_VECTOR_PROFILE } from "@/lib/meme-vectors";

const MODEL = "intfloat/multilingual-e5-small";
const REVISION = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
const MODEL_SHA256 = "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665";
const modelRoot = join(process.cwd(), ".local", "embedding-models");
let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;
let retryAfter = 0;
const pending = new Map<string, Promise<number[] | null>>();
const cache = new Map<string, { vector: number[]; expires: number }>();

async function getPipeline(): Promise<FeatureExtractionPipeline> {
  if (pipelinePromise) return pipelinePromise;
  if (Date.now() < retryAfter) throw new Error("embedding_unavailable");
  const start = performance.now();
  const cpu = process.cpuUsage();
  pipelinePromise = (async () => {
    const manifest = JSON.parse(await readFile(join(modelRoot, MODEL, "manifest.json"), "utf8"));
    if (manifest.model !== MODEL || manifest.revision !== REVISION || manifest.dtype !== "fp32"
      || manifest.dimensions !== 384
      || !manifest.files?.some((file: { path: string; sha256: string }) =>
        file.path === "onnx/model.onnx" && file.sha256 === MODEL_SHA256)) {
      throw new Error("embedding_model_mismatch");
    }
    const { env, pipeline } = await loadEmbeddingPipeline();
    env.localModelPath = modelRoot;
    env.allowRemoteModels = false;
    env.useFSCache = false;
    env.useBrowserCache = false;
    const extractor = await pipeline("feature-extraction", MODEL, {
      local_files_only: true, revision: REVISION, device: "cpu", dtype: "fp32",
      session_options: {
        intraOpNumThreads: 1, interOpNumThreads: 1,
        executionMode: "sequential", graphOptimizationLevel: "all",
      },
    });
    extractor.tokenizer.model_max_length = 512;
    if (process.env.VERCEL) {
      const used = process.cpuUsage(cpu);
      console.info("meme_embedding_ready", JSON.stringify({
        revision: REVISION, dtype: "fp32", dimensions: 384,
        elapsedMs: Math.round(performance.now() - start), cpuMs: Math.round((used.user + used.system) / 1000),
        rssBytes: process.memoryUsage().rss, maxRssKiB: process.resourceUsage().maxRSS,
      }));
    }
    return extractor;
  })().catch((error: unknown) => {
    pipelinePromise = null;
    retryAfter = Date.now() + 30_000;
    throw error;
  });
  return pipelinePromise;
}

/** One CPU inference at a time; repeated queries share work and successful vectors. */
export async function embedBundledMemeInput(input: string): Promise<number[] | null> {
  if (process.env.MEMECATCH_RUNTIME === "cloudflare") return null;
  if (process.env.MEME_EMBEDDING_RUNTIME !== "bundled" || !input.startsWith("query: ")) return null;
  const query = input.slice(7);
  if (query.length < 2 || query.length > 120 || query !== query.normalize("NFKC").trim()) return null;
  return runBundledMemeInput(input, true);
}

/** Internal catalog indexing only; callers supply the exact SQL document, never a prefixed input. */
export async function embedBundledMemePassage(document: string): Promise<number[] | null> {
  if (!document.trim() || Array.from(document).length > 6900) return null;
  if (process.env.MEMECATCH_RUNTIME === "cloudflare") {
    if (!externalEmbeddingRuntimeConfigured()) return null;
    return embedRemoteMemePassage(document);
  }
  if (process.env.MEME_EMBEDDING_RUNTIME !== "bundled") return null;
  return runBundledMemeInput(`passage: ${document}`, false);
}

async function embedRemoteMemePassage(document: string): Promise<number[] | null> {
  const endpoint = process.env.MEME_EMBEDDING_URL?.trim();
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.MEME_EMBEDDING_API_KEY
          ? { authorization: `Bearer ${process.env.MEME_EMBEDDING_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ model: MEME_VECTOR_PROFILE, input: `passage: ${document}` }),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const result = await response.json() as { model?: unknown; data?: { embedding?: unknown }[] };
    const vector = result.data?.[0]?.embedding;
    return result.model === MEME_VECTOR_PROFILE && isMemeVector(vector) ? vector : null;
  } catch {
    return null;
  }
}

async function runBundledMemeInput(input: string, cacheQuery: boolean): Promise<number[] | null> {
  if (cacheQuery) {
    const cached = cache.get(input);
    if (cached && cached.expires > Date.now()) {
      cache.delete(input);
      cache.set(input, cached);
      return [...cached.vector];
    }
    cache.delete(input);
  }
  if (pending.has(input)) return pending.get(input)!.then((vector) => vector ? [...vector] : null);
  if (pending.size >= 1) return null;
  const operation = (async () => {
    try {
      const extractor = await getPipeline();
      const output = await extractor(input, { pooling: "mean", normalize: true });
      const vector: unknown = output.tolist()[0];
      if (!isMemeVector(vector)) return null;
      if (cacheQuery) {
        cache.set(input, { vector: [...vector], expires: Date.now() + 300_000 });
        while (cache.size > 64) cache.delete(cache.keys().next().value!);
      }
      return vector;
    } catch { return null; }
  })().finally(() => pending.delete(input));
  pending.set(input, operation);
  return operation.then((vector) => vector ? [...vector] : null);
}
