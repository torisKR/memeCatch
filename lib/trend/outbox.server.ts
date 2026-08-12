import "server-only";

import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type NotificationChannel = "in_app" | "email" | "web_push" | "webhook";

export type NotificationOutboxItem = {
  outboxId: string;
  topic: string;
  channel: NotificationChannel;
  userId: string | null;
  memeId: string | null;
  payload: Json;
  claimToken: string;
  attemptCount: number;
};

export type NotificationDispatcher = (
  item: NotificationOutboxItem,
) => Promise<void>;

export async function runNotificationOutbox(input: {
  dispatchers: Partial<Record<NotificationChannel, NotificationDispatcher>>;
  limit?: number;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_notification_outbox", {
    p_limit: input.limit ?? 100,
  });
  if (error) return { status: "failed" as const, delivered: 0, failed: 0 };

  let delivered = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const item: NotificationOutboxItem = {
      outboxId: row.outbox_id,
      topic: row.topic,
      channel: row.channel as NotificationChannel,
      userId: row.user_id,
      memeId: row.meme_id,
      payload: row.payload,
      claimToken: row.claim_token,
      attemptCount: row.attempt_count,
    };
    const dispatcher = input.dispatchers[item.channel];
    try {
      if (!dispatcher) throw new Error("dispatcher_not_configured");
      await dispatcher(item);
      const { data: finished, error: finishError } = await admin.rpc(
        "finish_notification_outbox",
        {
          p_outbox_id: item.outboxId,
          p_claim_token: item.claimToken,
          p_succeeded: true,
        },
      );
      if (finishError || finished !== true) throw new Error("finish_failed");
      delivered += 1;
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "delivery_failed";
      await admin.rpc("finish_notification_outbox", {
        p_outbox_id: item.outboxId,
        p_claim_token: item.claimToken,
        p_succeeded: false,
        p_error: message,
      });
      failed += 1;
    }
  }

  return {
    status: failed === 0 ? "ok" as const : delivered === 0 ? "failed" as const : "partial" as const,
    delivered,
    failed,
  };
}
