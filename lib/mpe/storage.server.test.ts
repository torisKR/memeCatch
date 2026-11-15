import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: mocks.from },
    from: () => ({ insert: mocks.insert }),
  }),
}));

import { deleteTemporaryMedia, putTemporaryMedia, recordTemporaryCleanupFailure } from "./storage.server";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockReturnValue({ upload: mocks.upload, remove: mocks.remove });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.insert.mockResolvedValue({ error: null });
});

describe("MPE server-owned storage", () => {
  it("uses only the admin storage client for upload and cleanup", async () => {
    const key = "10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002";
    await putTemporaryMedia(key, new ArrayBuffer(1), "image/png");
    await deleteTemporaryMedia(key);
    expect(mocks.from).toHaveBeenCalledTimes(2);
    expect(mocks.upload).toHaveBeenCalledWith(key, expect.any(ArrayBuffer), {
      contentType: "image/png", upsert: false,
    });
    expect(mocks.remove).toHaveBeenCalledWith([key]);
  });

  it("durably records an orphan cleanup failure without file contents", async () => {
    const key = "10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002";
    await recordTemporaryCleanupFailure(key, "10000000-0000-4000-8000-000000000001");
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
      action: "mpe_upload_orphan_cleanup_failed",
      entity_id: key,
      detail: { bucket: "mpe-temporary" },
    }));
  });
});
