import { afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createAdminClient: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }));
vi.mock("@/lib/db/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("./recovery.server", () => ({
  listDueSourceAcquisitionRecovery: vi.fn().mockResolvedValue([]),
  listActiveSourceAcquisitionRecovery: vi.fn().mockResolvedValue([]),
  recordSourceAcquisitionFailure: vi.fn().mockResolvedValue({ recorded: true }),
  resolveSourceAcquisitionFailure: vi.fn().mockResolvedValue(undefined),
  sourceAcquisitionKey: (platform: string, id: string) => `${platform}:${id}`,
}));

import { runSourceRefresh } from "./refresh.server";
import { recordSourceAcquisitionFailure } from "./recovery.server";

function query(data: unknown[]) {
  const builder = {
    select: vi.fn(), is: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), in: vi.fn(), not: vi.fn(),
    update: vi.fn(), eq: vi.fn(), neq: vi.fn(), then: undefined,
  } as unknown as Record<string, ReturnType<typeof vi.fn>> & { then: ReturnType<typeof vi.fn> | undefined };
  for (const method of ["select", "is", "or", "order", "limit", "in", "not", "update", "eq", "neq"]) builder[method].mockReturnValue(builder);
  builder.then = vi.fn((resolve) => Promise.resolve({ data, error: null }).then(resolve));
  return builder;
}

function setup(body: unknown) {
  const sources = [
    { id: "source-a", platform: "youtube", external_id: "abcdefghijk", canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", embeddable: true, removed_at: null },
    { id: "source-b", platform: "youtube", external_id: "lmnopqrstuv", canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv", embeddable: true, removed_at: null },
  ];
  const source = query(sources);
  const content = query([]);
  const jobInsert = vi.fn().mockResolvedValue({ error: null });
  const client = { from: vi.fn((table: string) => table === "job_runs" ? { insert: jobInsert } : table === "meme_contents" ? content : source) };
  mocks.createAdminClient.mockReturnValue(client);
  vi.stubEnv("YOUTUBE_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
  return { source, content, jobInsert };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("does not write or mark either source dead when a real HTTP response has incomplete item status", async () => {
  const { source, content, jobInsert } = setup({ items: [{ id: "abcdefghijk", status: { privacyStatus: "public" } }] });
  const result = await runSourceRefresh();
  expect(result.status).toBe("partial");
  expect(result.error).toBe("youtube_video_list_inconclusive");
  expect(source.update).not.toHaveBeenCalled();
  expect(content.update).not.toHaveBeenCalled();
  expect(recordSourceAcquisitionFailure).toHaveBeenCalledTimes(2);
  expect(jobInsert).toHaveBeenCalledWith(expect.objectContaining({ ok: false }));
});

it("keeps upstream error bodies out of the result and job audit", async () => {
  const { jobInsert } = setup({ items: [] });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("sensitive-upstream-body", { status: 403 })));
  const result = await runSourceRefresh();
  expect(result.status).toBe("partial");
  expect(result.error).toBe("YouTube API HTTP 403");
  expect(JSON.stringify(jobInsert.mock.calls)).not.toContain("sensitive-upstream-body");
});

it("marks omitted sources unavailable only after a well-formed empty HTTP list", async () => {
  const { source, content } = setup({ items: [] });
  const result = await runSourceRefresh();
  expect(result.status).toBe("ok");
  expect(result.youtube.removed).toBe(2);
  expect(source.update).toHaveBeenCalledTimes(2);
  expect(content.update).toHaveBeenCalledWith({ availability: "dead" });
});

it("updates a valid returned video and marks only the omitted video unavailable", async () => {
  const { source, content } = setup({ items: [{ id: "abcdefghijk", status: { privacyStatus: "public", embeddable: true } }] });
  const result = await runSourceRefresh();
  expect(result.status).toBe("ok");
  expect(result.youtube.removed).toBe(1);
  expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ public_status: "public", removed_at: null }));
  expect(source.update).toHaveBeenCalledWith(expect.objectContaining({ removed_at: expect.any(String), title: null }));
  expect(content.update).toHaveBeenCalledWith({ availability: "live" });
  expect(content.update).toHaveBeenCalledWith({ availability: "dead" });
});
