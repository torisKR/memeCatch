/** Build stub. The Cloudflare Worker does not load transformers or ONNX. */
export const env: Record<string, unknown> = {};

export async function pipeline(): Promise<never> {
  throw new Error("onnx_unavailable_on_workers");
}
