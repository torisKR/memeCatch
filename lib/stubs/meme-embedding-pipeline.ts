/** Cloudflare build replacement. The Worker never loads transformers or ONNX. */
export async function loadEmbeddingPipeline(): Promise<never> {
  throw new Error("onnx_unavailable_on_workers");
}
