/** Build stub. onnxruntime is not part of the Worker bundle. */
export class InferenceSession {
  static async create(): Promise<never> {
    throw new Error("onnx_unavailable_on_workers");
  }
}
