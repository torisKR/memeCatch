/** Real ONNX loader. The Cloudflare build aliases this module to a stub. */
export async function loadEmbeddingPipeline() {
  const { env, pipeline } = await import("@huggingface/transformers");
  return { env, pipeline };
}
