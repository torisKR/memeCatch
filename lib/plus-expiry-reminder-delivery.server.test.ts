import { describe, expect, it, vi } from "vitest";
import {
  buildPlusExpiryReminderEmail,
  runPlusExpiryReminders,
} from "@/lib/plus-expiry-reminder-delivery.server";

vi.mock("server-only", () => ({}));

type RunOptions = NonNullable<Parameters<typeof runPlusExpiryReminders>[0]>;

function adminWith({
  delivery,
  email = "user@example.com",
  finish = true,
}: {
  delivery?: Record<string, unknown>;
  email?: string | null;
  finish?: boolean;
} = {}) {
  const rpc = vi.fn()
    .mockResolvedValueOnce({ data: delivery ? 1 : 0, error: null })
    .mockResolvedValueOnce({ data: delivery ? [delivery] : [], error: null })
    .mockResolvedValueOnce({ data: finish, error: null });
  return {
    client: {
      rpc,
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: email === null ? null : { email } },
          }),
        },
      },
    } as unknown as RunOptions["admin"],
    rpc,
  };
}

describe("Plus expiry reminder email", () => {
  it.each([7, 3, 1, 0] as const)("builds the %i-day checkout CTA without user data", (days) => {
    const email = buildPlusExpiryReminderEmail({
      locale: "en",
      reminderDays: days,
      baseUrl: "https://catchmeme.com",
    });

    expect(email.html).toContain(
      `https://catchmeme.com/en/pricing?source=expiry_reminder`,
    );
    expect(email.text).toContain(
      "https://catchmeme.com/en/pricing?source=expiry_reminder",
    );
    expect(JSON.stringify(email)).not.toMatch(/user_id|email/i);
  });
});

describe("Plus expiry reminder delivery", () => {
  it("does not create a database client when the relay is not configured", async () => {
    await expect(
      runPlusExpiryReminders({ deliveryUrl: undefined, fromEmail: undefined }),
    ).resolves.toMatchObject({ status: "not_configured", claimed: 0 });
  });

  it("queues, claims, sends, and marks a reminder sent", async () => {
    const delivery = {
      delivery_id: "delivery-7",
      user_id: "user-1",
      current_period_end: "2026-08-25T00:00:00.000Z",
      reminder_days: 7,
      locale: "ko",
      status: "processing",
    };
    const { client, rpc } = adminWith({ delivery });
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "provider-7" }), { status: 202 }),
    );

    const result = await runPlusExpiryReminders({
      now: new Date("2026-08-18T01:00:00.000Z"),
      admin: client,
      fetchImpl,
      deliveryUrl: "https://relay.example.test/send",
      deliveryToken: "relay-token",
      fromEmail: "signals@catchmeme.com",
    });

    expect(result).toMatchObject({
      status: "ok",
      deliveryDate: "2026-08-18",
      queued: 1,
      claimed: 1,
      sent: 1,
      failed: 0,
    });
    const payload = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({
      from: "signals@catchmeme.com",
      to: ["user@example.com"],
      idempotencyKey: "delivery-7",
      metadata: { deliveryId: "delivery-7", reminderDays: 7, locale: "ko" },
    });
    expect(payload.html).toContain(
      "/pricing?source=expiry_reminder",
    );
    expect(rpc).toHaveBeenNthCalledWith(2, "claim_plus_expiry_reminders", {
      p_delivery_date: "2026-08-18",
      p_limit: 100,
    });
    expect(rpc).toHaveBeenLastCalledWith("finish_plus_expiry_reminder", {
      p_delivery_id: "delivery-7",
      p_status: "sent",
      p_error_code: null,
      p_provider_message_id: "provider-7",
    });
  });

  it("marks a missing recipient skipped and a provider rejection failed", async () => {
    const delivery = {
      delivery_id: "delivery-0",
      user_id: "user-2",
      current_period_end: "2026-08-18T12:00:00.000Z",
      reminder_days: 0,
      locale: "en",
      status: "processing",
    };
    const missing = adminWith({ delivery, email: null });
    await expect(
      runPlusExpiryReminders({
        admin: missing.client,
        deliveryUrl: "https://relay.example.test/send",
        fromEmail: "signals@catchmeme.com",
      }),
    ).resolves.toMatchObject({ status: "ok", skipped: 1, sent: 0 });
    expect(missing.rpc).toHaveBeenLastCalledWith("finish_plus_expiry_reminder", {
      p_delivery_id: "delivery-0",
      p_status: "skipped",
      p_error_code: "recipient_missing",
      p_provider_message_id: null,
    });

    const rejected = adminWith({ delivery });
    await expect(
      runPlusExpiryReminders({
        admin: rejected.client,
        fetchImpl: vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
        deliveryUrl: "https://relay.example.test/send",
        fromEmail: "signals@catchmeme.com",
      }),
    ).resolves.toMatchObject({ status: "failed", failed: 1, sent: 0 });
    expect(rejected.rpc).toHaveBeenLastCalledWith("finish_plus_expiry_reminder", {
      p_delivery_id: "delivery-0",
      p_status: "failed",
      p_error_code: "provider_http_503",
      p_provider_message_id: null,
    });
  });

  it("moves a claimed delivery to failed when recipient lookup throws", async () => {
    const delivery = {
      delivery_id: "delivery-lookup",
      user_id: "user-3",
      current_period_end: "2026-08-21T12:00:00.000Z",
      reminder_days: 3,
      locale: "en",
      status: "processing",
    };
    const { client, rpc } = adminWith({ delivery });
    client!.auth.admin.getUserById = vi.fn().mockRejectedValue(new Error("auth unavailable"));

    await expect(
      runPlusExpiryReminders({
        admin: client,
        deliveryUrl: "https://relay.example.test/send",
        fromEmail: "signals@catchmeme.com",
      }),
    ).resolves.toMatchObject({ status: "failed", failed: 1 });
    expect(rpc).toHaveBeenLastCalledWith("finish_plus_expiry_reminder", {
      p_delivery_id: "delivery-lookup",
      p_status: "failed",
      p_error_code: "delivery_processing_failed",
      p_provider_message_id: null,
    });
  });
});
