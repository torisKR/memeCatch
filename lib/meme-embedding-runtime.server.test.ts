import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  pipeline: vi.fn(),
  extractor: Object.assign(vi.fn(), { tokenizer: { model_max_length: 0 } }),
  env: {} as Record<string, unknown>,
  fetch: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("@huggingface/transformers", () => ({ env: mocks.env, pipeline: mocks.pipeline }));

const model = "intfloat/multilingual-e5-small";
const revision = "614241f622f53c4eeff9890bdc4f31cfecc418b3";
const modelHash = "ca456c06b3a9505ddfd9131408916dd79290368331e7d76bb621f1cba6bc8665";
const input = "query: 일상 업무";

function manifest() {
  return { model, revision, dtype: "fp32", dimensions: 384,
    files: [{ path: "onnx/model.onnx", sha256: modelHash }] };
}
function vector() {
  return Array.from({ length: 384 }, (_, index) => index === 0 ? 1 : 0);
}
function output(embedding: unknown = vector()) {
  return { tolist: () => [embedding] };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

let now: number;
let runtime: typeof import("./meme-embedding-runtime.server");

beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  for (const key of Object.keys(mocks.env)) delete mocks.env[key];
  mocks.env.allowRemoteModels = true;
  mocks.env.useFSCache = true;
  mocks.env.useBrowserCache = true;
  mocks.extractor.tokenizer.model_max_length = 0;
  mocks.readFile.mockResolvedValue(JSON.stringify(manifest()));
  mocks.pipeline.mockResolvedValue(mocks.extractor);
  mocks.extractor.mockResolvedValue(output());
  mocks.fetch.mockRejectedValue(new Error("Network access is forbidden in this unit test"));
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("MEME_EMBEDDING_RUNTIME", "bundled");
  now = 1_791_061_200_000;
  vi.spyOn(Date, "now").mockImplementation(() => now);
  runtime = await import("./meme-embedding-runtime.server");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("bundled FP32 embedding runtime", () => {
  it.each(["", "remote", undefined])("does not load assets when bundled runtime is disabled", async (mode) => {
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", mode);
    expect(await runtime.embedBundledMemeInput(input)).toBeNull();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.pipeline).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    "", "일상 업무", "passage: 일상 업무", "query: x", "query:  일상 업무",
    "query: 일상 업무 ", "query: ＡＩ", `query: ${"일".repeat(121)}`,
  ])("rejects invalid prefixes, lengths and noncanonical queries before loading", async (value) => {
    expect(await runtime.embedBundledMemeInput(value)).toBeNull();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.pipeline).not.toHaveBeenCalled();
  });

  it.each([2, 120])("accepts the normalized query length boundary %s", async (length) => {
    const bounded = `query: ${"일".repeat(length)}`;
    expect(await runtime.embedBundledMemeInput(bounded)).toEqual(vector());
    expect(mocks.extractor).toHaveBeenCalledExactlyOnceWith(bounded, { pooling: "mean", normalize: true });
  });

  it("loads only the pinned local FP32 model using one sequential CPU thread and 512 tokens", async () => {
    expect(await runtime.embedBundledMemeInput(input)).toEqual(vector());
    const modelRoot = join(process.cwd(), ".local", "embedding-models");
    expect(mocks.readFile).toHaveBeenCalledExactlyOnceWith(join(modelRoot, model, "manifest.json"), "utf8");
    expect(mocks.env).toMatchObject({
      localModelPath: modelRoot, allowRemoteModels: false, useFSCache: false, useBrowserCache: false,
    });
    expect(mocks.pipeline).toHaveBeenCalledExactlyOnceWith("feature-extraction", model, {
      local_files_only: true, revision, device: "cpu", dtype: "fp32",
      session_options: {
        intraOpNumThreads: 1, interOpNumThreads: 1,
        executionMode: "sequential", graphOptimizationLevel: "all",
      },
    });
    expect(mocks.extractor.tokenizer.model_max_length).toBe(512);
    expect(mocks.extractor).toHaveBeenCalledExactlyOnceWith(input, { pooling: "mean", normalize: true });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([
    { model: "other-model" }, { revision: "main" }, { dtype: "q8" },
    { dimensions: 768 }, { files: [] },
    { files: [{ path: "onnx/model.onnx", sha256: "f".repeat(64) }] },
    { files: [{ path: "onnx/model_quantized.onnx", sha256: modelHash }] },
    { files: "invalid" },
  ])("rejects a mismatched local asset manifest before importing a pipeline", async (override) => {
    mocks.readFile.mockResolvedValue(JSON.stringify({ ...manifest(), ...override }));
    expect(await runtime.embedBundledMemeInput(input)).toBeNull();
    expect(mocks.pipeline).not.toHaveBeenCalled();
    expect(mocks.extractor).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each(["malformed", "missing"])("backs off for 30 seconds after a %s manifest", async (failure) => {
    if (failure === "malformed") mocks.readFile.mockResolvedValueOnce("invalid JSON");
    else mocks.readFile.mockRejectedValueOnce(new Error("ENOENT"));
    expect(await runtime.embedBundledMemeInput(input)).toBeNull();
    expect(await runtime.embedBundledMemeInput("query: 다른 업무")).toBeNull();
    now += 29_999;
    expect(await runtime.embedBundledMemeInput(input)).toBeNull();
    expect(mocks.readFile).toHaveBeenCalledOnce();
    expect(mocks.pipeline).not.toHaveBeenCalled();
    now += 1;
    expect(await runtime.embedBundledMemeInput(input)).toEqual(vector());
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
    expect(mocks.pipeline).toHaveBeenCalledOnce();
  });

  it("retries pipeline initialization only after its 30-second failure backoff", async () => {
    mocks.pipeline.mockRejectedValueOnce(new Error("native initialization unavailable"));
    expect(await runtime.embedBundledMemeInput(input)).toBeNull();
    now += 29_999;
    expect(await runtime.embedBundledMemeInput("query: 다른 업무")).toBeNull();
    expect(mocks.pipeline).toHaveBeenCalledOnce();
    expect(mocks.readFile).toHaveBeenCalledOnce();
    now += 1;
    expect(await runtime.embedBundledMemeInput(input)).toEqual(vector());
    expect(mocks.pipeline).toHaveBeenCalledTimes(2);
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
  });

  it("shares initialization and concurrent identical requests while returning independent vectors", async () => {
    const read = deferred<string>();
    mocks.readFile.mockReturnValueOnce(read.promise);
    const first = runtime.embedBundledMemeInput(input);
    const duplicate = runtime.embedBundledMemeInput(input);
    expect(mocks.readFile).toHaveBeenCalledOnce();
    read.resolve(JSON.stringify(manifest()));
    const [a, b] = await Promise.all([first, duplicate]);
    expect(a).toEqual(vector());
    expect(b).toEqual(vector());
    expect(a).not.toBe(b);
    a![0] = 0;
    expect(b).toEqual(vector());
    expect(await runtime.embedBundledMemeInput(input)).toEqual(vector());
    expect(mocks.pipeline).toHaveBeenCalledOnce();
    expect(mocks.extractor).toHaveBeenCalledOnce();
  });

  it("rejects other queries during one in-flight inference and admits them after completion", async () => {
    const inference = deferred<ReturnType<typeof output>>();
    mocks.extractor.mockReturnValueOnce(inference.promise);
    const first = runtime.embedBundledMemeInput(input);
    await vi.waitFor(() => expect(mocks.extractor).toHaveBeenCalledOnce());
    expect(await runtime.embedBundledMemeInput("query: 다른 업무")).toBeNull();
    expect(mocks.extractor).toHaveBeenCalledOnce();
    inference.resolve(output());
    expect(await first).toEqual(vector());
    expect(await runtime.embedBundledMemeInput("query: 다른 업무")).toEqual(vector());
    expect(mocks.pipeline).toHaveBeenCalledOnce();
    expect(mocks.extractor).toHaveBeenCalledTimes(2);
  });

  it("caches successful vectors for five minutes and copies values on every cache read", async () => {
    const first = await runtime.embedBundledMemeInput(input);
    first![0] = 0;
    const cached = await runtime.embedBundledMemeInput(input);
    expect(cached).toEqual(vector());
    cached![1] = 1;
    now += 299_999;
    expect(await runtime.embedBundledMemeInput(input)).toEqual(vector());
    expect(mocks.extractor).toHaveBeenCalledOnce();
    now += 1;
    expect(await runtime.embedBundledMemeInput(input)).toEqual(vector());
    expect(mocks.extractor).toHaveBeenCalledTimes(2);
    expect(mocks.pipeline).toHaveBeenCalledOnce();
  });

  it("evicts the least recently used successful query at 64 entries", async () => {
    for (let index = 0; index < 64; index++) await runtime.embedBundledMemeInput(`query: 상황 ${index}`);
    await runtime.embedBundledMemeInput("query: 상황 0");
    await runtime.embedBundledMemeInput("query: 상황 64");
    await runtime.embedBundledMemeInput("query: 상황 0");
    expect(mocks.extractor).toHaveBeenCalledTimes(65);
    await runtime.embedBundledMemeInput("query: 상황 1");
    expect(mocks.extractor).toHaveBeenCalledTimes(66);
    expect(mocks.pipeline).toHaveBeenCalledOnce();
  });

  it("does not serve cached vectors after the bundled runtime is disabled", async () => {
    await runtime.embedBundledMemeInput(input);
    vi.stubEnv("MEME_EMBEDDING_RUNTIME", "");
    expect(await runtime.embedBundledMemeInput(input)).toBeNull();
    expect(mocks.extractor).toHaveBeenCalledOnce();
  });

  it.each([null, undefined, [], [1], Array(384).fill(0), Array(384).fill(Infinity)].map((embedding) => ({ embedding })))(
    "does not cache invalid inference outputs", async ({ embedding }) => {
      mocks.extractor.mockResolvedValueOnce({ tolist: () => [embedding] }).mockResolvedValueOnce(output());
      expect(await runtime.embedBundledMemeInput(input)).toBeNull();
      expect(await runtime.embedBundledMemeInput(input)).toEqual(vector());
      expect(mocks.extractor).toHaveBeenCalledTimes(2);
      expect(mocks.pipeline).toHaveBeenCalledOnce();
    },
  );

  it("releases failed in-flight inference for retry without reloading the initialized model", async () => {
    mocks.extractor.mockRejectedValueOnce(new Error("private native path")).mockResolvedValueOnce(output());
    expect(await runtime.embedBundledMemeInput(input)).toBeNull();
    expect(await runtime.embedBundledMemeInput(input)).toEqual(vector());
    expect(mocks.extractor).toHaveBeenCalledTimes(2);
    expect(mocks.pipeline).toHaveBeenCalledOnce();
  });
});
