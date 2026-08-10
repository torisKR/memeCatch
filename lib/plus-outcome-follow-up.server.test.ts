import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const from = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from }),
}));

import {
  loadPlusOutcomeFollowUps,
  type PlusOutcomeLedgerSupabase,
} from "@/lib/plus-outcome-ledger.server";

const supabase = { from } as unknown as PlusOutcomeLedgerSupabase;
const dateWindow = { from: "2026-08-03", to: "2026-08-09" };

function query(data: unknown, error: unknown = null) {
  const builder = {
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockResolvedValue({ data, error });
  from.mockReturnValue({
    select: vi.fn().mockReturnValue(builder),
  });
  return builder;
}

beforeEach(() => vi.clearAllMocks());

describe("Plus outcome follow-up server loader", () => {
  it("does not query locked accounts", async () => {
    await expect(
      loadPlusOutcomeFollowUps({
        supabase,
        isPremium: false,
        fromDate: dateWindow.from,
        toDate: dateWindow.to,
      }),
    ).resolves.toEqual({ status: "locked", items: [], pendingCount: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns unavailable on a private receipt query failure", async () => {
    query(null, { message: "query_failed" });
    await expect(
      loadPlusOutcomeFollowUps({
        supabase,
        isPremium: true,
        fromDate: dateWindow.from,
        toDate: dateWindow.to,
      }),
    ).resolves.toEqual({ status: "unavailable", items: [], pendingCount: 0 });
  });

  it("uses the seven-day owner-scoped receipt window and sorts pending first", async () => {
    const builder = query([
      {
        id: "receipt-1",
        meme_id: "meme-1",
        completion_date: "2026-08-04",
        title_snapshot: "Older completed",
        channel: "threads",
        locale: "en",
        artifact_kind: "caption",
        performance_note: "done",
        performance_rating: null,
      },
      {
        id: "receipt-2",
        meme_id: "meme-2",
        completion_date: "2026-08-09",
        title_snapshot: "Pending newer",
        channel: "instagram",
        locale: "ja",
        artifact_kind: "creator_pack",
        performance_note: null,
        performance_rating: null,
      },
    ]);

    await expect(
      loadPlusOutcomeFollowUps({
        supabase,
        isPremium: true,
        fromDate: dateWindow.from,
        toDate: dateWindow.to,
      }),
    ).resolves.toMatchObject({
      status: "ready",
      pendingCount: 1,
      items: [
        { receiptId: "receipt-2", title: "Pending newer" },
        { receiptId: "receipt-1", title: "Older completed" },
      ],
    });
    expect(builder.gte).toHaveBeenCalledWith("completion_date", dateWindow.from);
    expect(builder.lte).toHaveBeenCalledWith("completion_date", dateWindow.to);
    expect(builder.limit).toHaveBeenCalledWith(30);
  });
});
