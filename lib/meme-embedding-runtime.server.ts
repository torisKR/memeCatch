import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import { isMemeVector } from "@/lib/meme-vectors";

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
    const { env, pipeline } = await import("@huggingface/transformers");
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
  if (process.env.MEME_EMBEDDING_RUNTIME !== "bundled" || !input.startsWith("query: ")) return null;
  const query = input.slice(7);
  if (query.length < 2 || query.length > 120 || query !== query.normalize("NFKC").trim()) return null;
  const cached = cache.get(input);
  if (cached && cached.expires > Date.now()) {
    cache.delete(input);
    cache.set(input, cached);
    return [...cached.vector];
  }
  cache.delete(input);
  if (pending.has(input)) return pending.get(input)!.then((vector) => vector ? [...vector] : null);
  if (pending.size >= 1) return null;
  const operation = (async () => {
    try {
      const extractor = await getPipeline();
      const output = await extractor(input, { pooling: "mean", normalize: true });
      const vector: unknown = output.tolist()[0];
      if (!isMemeVector(vector)) return null;
      cache.set(input, { vector: [...vector], expires: Date.now() + 300_000 });
      while (cache.size > 64) cache.delete(cache.keys().next().value!);
      return vector;
    } catch { return null; }
  })().finally(() => pending.delete(input));
  pending.set(input, operation);
  return operation.then((vector) => vector ? [...vector] : null);
}
