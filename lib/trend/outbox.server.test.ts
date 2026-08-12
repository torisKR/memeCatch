import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));

import { runNotificationOutbox } from "@/lib/trend/outbox.server";

describe("runNotificationOutbox", () => {
  it("dispatches configured channels and retries unconfigured channels", async () => {
    rpc
      .mockResolvedValueOnce({
        data: [
          {
            outbox_id: "outbox-1",
            topic: "meme.state.changed",
            channel: "in_app",
            user_id: null,
            meme_id: "meme-1",
            payload: {},
            claim_token: "claim-1",
            attempt_count: 1,
          },
          {
            outbox_id: "outbox-2",
            topic: "meme.safety.changed",
            channel: "email",
            user_id: "user-1",
            meme_id: "meme-1",
            payload: {},
            claim_token: "claim-2",
            attempt_count: 1,
          },
        ],
        error: null,
      })
      .mockResolvedValue({ data: true, error: null });
    const inApp = vi.fn().mockResolvedValue(undefined);

    await expect(
      runNotificationOutbox({ dispatchers: { in_app: inApp } }),
    ).resolves.toEqual({ status: "partial", delivered: 1, failed: 1 });
    expect(inApp).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith(
      "finish_notification_outbox",
      expect.objectContaining({ p_outbox_id: "outbox-2", p_succeeded: false }),
    );
  });
});
