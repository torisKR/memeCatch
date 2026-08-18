import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
const getUserById = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc, auth: { admin: { getUserById } } }),
}));

import {
  buildSavedStateChangeEmail,
  runNotificationOutbox,
  runSavedStateChangeEmails,
} from "@/lib/trend/outbox.server";

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

  it("uses the existing relay contract for an opted-in saved state email", async () => {
    rpc
      .mockReset()
      .mockResolvedValueOnce({
        data: [{
          outbox_id: "outbox-email",
          topic: "meme.state.changed",
          channel: "email",
          user_id: "user-1",
          meme_id: "meme-1",
          payload: {
            title: "Test meme",
            short_id: "abc123",
            old_state: "candidate",
            new_state: "rising",
            locale: "ko",
          },
          claim_token: "claim-email",
          attempt_count: 1,
        }],
        error: null,
      })
      .mockResolvedValue({ data: true, error: null });
    getUserById.mockResolvedValue({ data: { user: { email: "user@example.test" } }, error: null });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));

    await expect(runSavedStateChangeEmails({
      fetchImpl,
      deliveryUrl: "https://relay.example.test/send",
      deliveryToken: "token",
      fromEmail: "signals@example.test",
    })).resolves.toMatchObject({ status: "ok", delivered: 1, failed: 0 });
    expect(rpc).toHaveBeenCalledWith("claim_saved_state_email_outbox", { p_limit: 10 });
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      to: ["user@example.test"],
      idempotencyKey: "outbox-email",
      metadata: { outboxId: "outbox-email", topic: "meme.state.changed" },
    });
    expect(body.html).toContain("https://catchmeme.com/memes/abc123?source=saved_state_email");
  });

  it("builds an observed state message without claiming why it changed", () => {
    const email = buildSavedStateChangeEmail({
      title: "Test meme",
      shortId: "abc123",
      oldState: "candidate",
      newState: "rising",
      locale: "en",
    }, "https://catchmeme.com");
    expect(email.text).toContain("Candidate → Rising");
    expect(email.text).not.toMatch(/because|caused/i);
  });
});
