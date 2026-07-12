import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createAffiliateSyncRepository } from "@/lib/affiliate/repository.server";
import type { NormalizedAffiliateProduct } from "@/lib/affiliate/types";
import { createAdminClient } from "@/lib/supabase/admin";

const products = [{ externalKey: "product-1" }] as NormalizedAffiliateProduct[];

function createAdminMock(
  selectResult: {
    data: { upserted_count: number; deactivated_count: number } | null;
    error: Error | null;
  },
) {
  const single = vi.fn().mockResolvedValue(selectResult);
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({ data: undefined, error: null });
  const admin = { rpc, from } as unknown as ReturnType<typeof createAdminClient>;

  return { admin, rpc, from, select, eq, single };
}

describe("createAffiliateSyncRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies once, reads the run once, and returns persisted counts", async () => {
    const mock = createAdminMock({
      data: { upserted_count: 4, deactivated_count: 2 },
      error: null,
    });
    const repository = createAffiliateSyncRepository(mock.admin);

    await expect(
      repository.apply("run-1", "2026-07-13T01:00:00.000Z", products),
    ).resolves.toEqual({ upsertedCount: 4, deactivatedCount: 2 });
    expect(mock.rpc).toHaveBeenCalledOnce();
    expect(mock.rpc).toHaveBeenCalledWith("apply_affiliate_sync", {
      run_id: "run-1",
      synced_at: "2026-07-13T01:00:00.000Z",
      products,
    });
    expect(mock.from).toHaveBeenCalledOnce();
    expect(mock.from).toHaveBeenCalledWith("affiliate_sync_runs");
    expect(mock.select).toHaveBeenCalledWith(
      "upserted_count,deactivated_count",
    );
    expect(mock.eq).toHaveBeenCalledWith("id", "run-1");
    expect(mock.single).toHaveBeenCalledOnce();
  });

  it("maps a result select failure without reapplying", async () => {
    const mock = createAdminMock({
      data: null,
      error: new Error("database detail must not escape"),
    });
    const repository = createAffiliateSyncRepository(mock.admin);

    await expect(
      repository.apply("run-1", "2026-07-13T01:00:00.000Z", products),
    ).rejects.toThrow("DB_APPLY_RESULT_ERROR");
    expect(mock.rpc).toHaveBeenCalledOnce();
    expect(mock.from).toHaveBeenCalledOnce();
  });
});
