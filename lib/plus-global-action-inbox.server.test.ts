import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));

import { loadPlusGlobalActionInboxCompletion } from "@/lib/plus-global-action-inbox.server";
import type { PlusGlobalActionInboxSupabase } from "@/lib/plus-global-action-inbox.server";

const supabase = { rpc } as unknown as PlusGlobalActionInboxSupabase;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Plus Action Inbox completion loader", () => {
  it("keeps non-Plus and database failures unavailable", async () => {
    await expect(
      loadPlusGlobalActionInboxCompletion({ supabase, isPremium: false }),
    ).resolves.toMatchObject({ status: "unavailable" });

    rpc.mockResolvedValueOnce({ data: null, error: { message: "rpc_missing" } });
    await expect(
      loadPlusGlobalActionInboxCompletion({ supabase, isPremium: true }),
    ).resolves.toMatchObject({ status: "unavailable" });
  });

  it("loads today's completed meme ids and streak from the owner-scoped RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        completed_meme_ids: ["meme-1", "meme-2"],
        completed_today_count: 2,
        current_streak: 4,
      },
      error: null,
    });

    await expect(
      loadPlusGlobalActionInboxCompletion({ supabase, isPremium: true }),
    ).resolves.toEqual({
      status: "available",
      completedMemeIds: ["meme-1", "meme-2"],
      completedTodayCount: 2,
      currentStreak: 4,
    });
    expect(rpc).toHaveBeenCalledWith("get_plus_meme_use_summary");
  });
});
