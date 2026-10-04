import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  embedBundledMemePassage: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/meme-embedding-runtime.server", () => ({
  embedBundledMemePassage: mocks.embedBundledMemePassage,
}));

import { runMemeEmbeddingReindex } from "./meme-embedding-reindex.server";

const memeId = "94000000-0000-4000-8000-000000000001";
const sourceHash = "a".repeat(32);
const vector = [1, ...Array<number>(383).fill(0)];

function clientWith(handler: (name: string, args?: Record<string, unknown>) => unknown) {
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    try {
      return { data: await handler(name, args), error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : "rpc_failed" } };
    }
  });
  mocks.createAdminClient.mockReturnValue({ rpc });
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.embedBundledMemePassage.mockResolvedValue(vector);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("runMemeEmbeddingReindex", () => {
  it("acquires a 180-second lease and releases an empty run without loading the model", async () => {
    const rpc = clientWith((name) => {
      if (name === "acquire_meme_embedding_run") return true;
      if (name === "meme_embedding_backlog") return [{ pending: 0 }];
      if (name === "finish_meme_embedding_run") return true;
      throw new Error("unexpected_rpc");
    });

    await expect(runMemeEmbeddingReindex()).resolves.toEqual({
      status: "succeeded", indexed: 0, stale: 0, remaining: 0, errorCode: null,
    });
    expect(mocks.embedBundledMemePassage).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("acquire_meme_embedding_run", expect.objectContaining({ p_ttl_seconds: 180 }));
    expect(rpc).toHaveBeenCalledWith("finish_meme_embedding_run", expect.objectContaining({
      p_status: "succeeded", p_indexed: 0, p_stale: 0, p_remaining: 0, p_error_code: null,
    }));
  });

  it("processes at most 25 passages sequentially and stores only server-returned jobs", async () => {
    const jobs = Array.from({ length: 25 }, (_, index) => ({
      meme_id: `94000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      document: `공개 밈 문서 ${index}`,
      source_hash: sourceHash,
    }));
    let backlogCalls = 0;
    let active = 0;
    let maxActive = 0;
    mocks.embedBundledMemePassage.mockImplementation(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return vector;
    });
    const rpc = clientWith((name) => {
      if (name === "acquire_meme_embedding_run") return true;
      if (name === "meme_embedding_backlog") return [{ pending: backlogCalls++ === 0 ? 25 : 0 }];
      if (name === "list_meme_embedding_jobs") return jobs;
      if (name === "store_meme_embedding") return true;
      if (name === "finish_meme_embedding_run") return true;
      throw new Error("unexpected_rpc");
    });

    await expect(runMemeEmbeddingReindex()).resolves.toMatchObject({ status: "succeeded", indexed: 25, stale: 0 });
    expect(rpc).toHaveBeenCalledWith("list_meme_embedding_jobs", { p_limit: 25 });
    expect(mocks.embedBundledMemePassage).toHaveBeenCalledTimes(25);
    expect(maxActive).toBe(1);
  });

  it("accepts PostgreSQL UUIDs used by the existing seed records", async () => {
    let stored = false;
    clientWith((name) => {
      if (name === "acquire_meme_embedding_run") return true;
      if (name === "meme_embedding_backlog") return [{ pending: stored ? 0 : 1 }];
      if (name === "list_meme_embedding_jobs") return [{
        meme_id: "00000000-0000-0000-0000-000000000001", document: "기존 공개 seed", source_hash: sourceHash,
      }];
      if (name === "store_meme_embedding") { stored = true; return true; }
      if (name === "finish_meme_embedding_run") return true;
      throw new Error("unexpected_rpc");
    });
    expect(await runMemeEmbeddingReindex()).toMatchObject({ status: "succeeded", indexed: 1, remaining: 0 });
  });

  it("counts a source-hash race as stale and still releases the lease", async () => {
    let backlogCalls = 0;
    const rpc = clientWith((name) => {
      if (name === "acquire_meme_embedding_run") return true;
      if (name === "meme_embedding_backlog") return [{ pending: backlogCalls++ === 0 ? 1 : 1 }];
      if (name === "list_meme_embedding_jobs") return [{ meme_id: memeId, document: "변경 전 문서", source_hash: sourceHash }];
      if (name === "store_meme_embedding") return false;
      if (name === "finish_meme_embedding_run") return true;
      throw new Error("unexpected_rpc");
    });

    await expect(runMemeEmbeddingReindex()).resolves.toEqual({
      status: "partial", indexed: 0, stale: 1, remaining: 1, errorCode: null,
    });
    expect(rpc).toHaveBeenCalledWith("finish_meme_embedding_run", expect.objectContaining({
      p_status: "partial", p_stale: 1,
    }));
  });

  it("stops starting new passages at the 90-second budget", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    mocks.embedBundledMemePassage.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date("2026-10-04T00:01:30.001Z"));
      return vector;
    });
    let backlogCalls = 0;
    const rpc = clientWith((name) => {
      if (name === "acquire_meme_embedding_run") return true;
      if (name === "meme_embedding_backlog") return [{ pending: backlogCalls++ === 0 ? 2 : 1 }];
      if (name === "list_meme_embedding_jobs") return [
        { meme_id: memeId, document: "첫 문서", source_hash: sourceHash },
        { meme_id: "94000000-0000-4000-8000-000000000002", document: "둘째 문서", source_hash: sourceHash },
      ];
      if (name === "store_meme_embedding") return true;
      if (name === "finish_meme_embedding_run") return true;
      throw new Error("unexpected_rpc");
    });

    await expect(runMemeEmbeddingReindex()).resolves.toEqual({
      status: "partial", indexed: 0, stale: 0, remaining: 2, errorCode: "deadline_exceeded",
    });
    expect(mocks.embedBundledMemePassage).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("finish_meme_embedding_run", expect.objectContaining({
      p_status: "partial", p_error_code: "deadline_exceeded",
    }));
  });

  it("records only a generic model failure and releases the lease", async () => {
    mocks.embedBundledMemePassage.mockResolvedValueOnce(null);
    let backlogCalls = 0;
    const rpc = clientWith((name) => {
      if (name === "acquire_meme_embedding_run") return true;
      if (name === "meme_embedding_backlog") return [{ pending: backlogCalls++ === 0 ? 1 : 1 }];
      if (name === "list_meme_embedding_jobs") return [{ meme_id: memeId, document: "비공개 응답에 없어야 할 원문", source_hash: sourceHash }];
      if (name === "finish_meme_embedding_run") return true;
      throw new Error("unexpected_rpc");
    });

    const result = await runMemeEmbeddingReindex();
    expect(result).toEqual({ status: "failed", indexed: 0, stale: 0, remaining: 1, errorCode: "model_unavailable" });
    expect(JSON.stringify(result)).not.toContain("비공개");
    expect(rpc).toHaveBeenCalledWith("finish_meme_embedding_run", expect.objectContaining({
      p_status: "failed", p_error_code: "model_unavailable",
    }));
  });

  it("records an RPC failure after acquisition and still attempts lease release", async () => {
    let backlogCalls = 0;
    const rpc = clientWith((name) => {
      if (name === "acquire_meme_embedding_run") return true;
      if (name === "meme_embedding_backlog") return [{ pending: backlogCalls++ === 0 ? 1 : 1 }];
      if (name === "list_meme_embedding_jobs") throw new Error("raw_database_detail");
      if (name === "finish_meme_embedding_run") return true;
      throw new Error("unexpected_rpc");
    });

    const result = await runMemeEmbeddingReindex();
    expect(result).toEqual({ status: "failed", indexed: 0, stale: 0, remaining: 1, errorCode: "rpc_unavailable" });
    expect(JSON.stringify(result)).not.toContain("raw_database_detail");
    expect(rpc).toHaveBeenCalledWith("finish_meme_embedding_run", expect.objectContaining({
      p_status: "failed", p_error_code: "rpc_unavailable",
    }));
  });

  it("attaches an abort signal and caps a stalled work RPC at ten seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    const abortSignal = vi.fn((signal: AbortSignal) => {
      void signal;
      return new Promise<never>(() => {});
    });
    const operation = Object.assign(new Promise<never>(() => {}), { abortSignal });
    const rpc = vi.fn(() => operation);
    mocks.createAdminClient.mockReturnValue({ rpc });

    const pending = runMemeEmbeddingReindex();
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toEqual({
      status: "failed", indexed: 0, stale: 0, remaining: 0, errorCode: "rpc_unavailable",
    });
    expect(abortSignal).toHaveBeenCalledTimes(1);
    expect(abortSignal.mock.calls[0]?.[0].aborted).toBe(true);
    expect(mocks.embedBundledMemePassage).not.toHaveBeenCalled();
  });

  it("does not run the model when another invocation owns the lease", async () => {
    const rpc = clientWith((name) => {
      if (name === "acquire_meme_embedding_run") return false;
      if (name === "meme_embedding_backlog") return [{ pending: 7 }];
      throw new Error("unexpected_rpc");
    });

    await expect(runMemeEmbeddingReindex()).resolves.toEqual({
      status: "deferred", indexed: 0, stale: 0, remaining: 7, errorCode: null,
    });
    expect(mocks.embedBundledMemePassage).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("finish_meme_embedding_run", expect.anything());
  });
});
