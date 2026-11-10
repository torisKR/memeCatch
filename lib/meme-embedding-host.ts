type EnvSource = Readonly<Record<string, string | undefined>>;

/** An external embedding server. The Worker cannot load the local ONNX model. */
export function externalEmbeddingRuntimeConfigured(env: EnvSource = process.env): boolean {
  return env.MEME_EMBEDDING_RUNTIME !== "bundled" && Boolean(env.MEME_EMBEDDING_URL?.trim());
}

export type MemeEmbeddingsCronDisposition = "disabled" | "skip-onnx" | "run";

/**
 * Cloudflare with no external embedding server skips the cron.
 * The bundled ONNX runtime is not loaded into the Worker.
 */
export function memeEmbeddingsCronDisposition(env: EnvSource = process.env): MemeEmbeddingsCronDisposition {
  if (env.MEME_EMBEDDING_REINDEX_ENABLED !== "true") return "disabled";
  if (env.MEMECATCH_RUNTIME === "cloudflare" && !externalEmbeddingRuntimeConfigured(env)) {
    return "skip-onnx";
  }
  return "run";
}

/** Vercel and the Worker cannot reach a loopback embedding or chat process. */
export function hostedLoopbackForbidden(env: EnvSource = process.env): boolean {
  return Boolean(env.VERCEL) || env.MEMECATCH_RUNTIME === "cloudflare";
}
