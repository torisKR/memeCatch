import "server-only";

import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";

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

type OutboxAdmin = ReturnType<typeof createAdminClient>;
type ClaimedOutboxRow = {
  outbox_id: string;
  topic: string;
  channel: string;
  user_id: string | null;
  meme_id: string | null;
  payload: Json;
  claim_token: string;
  attempt_count: number;
};
type OutboxRpc = (name: string, args: Record<string, unknown>) => PromiseLike<{
  data: ClaimedOutboxRow[] | boolean | null;
  error: { message: string } | null;
}>;

export async function runNotificationOutbox(input: {
  dispatchers: Partial<Record<NotificationChannel, NotificationDispatcher>>;
  limit?: number;
  claimRpc?: "claim_notification_outbox" | "claim_saved_state_email_outbox";
  admin?: OutboxAdmin;
}) {
  const admin = input.admin ?? createAdminClient();
  const rpc = admin.rpc.bind(admin) as unknown as OutboxRpc;
  const { data, error } = await rpc(input.claimRpc ?? "claim_notification_outbox", {
    p_limit: input.limit ?? 100,
  });
  if (error) return { status: "failed" as const, delivered: 0, failed: 0 };

  const rows = Array.isArray(data) ? data : [];
  const outcomes = await Promise.all(rows.map(async (row) => {
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
      const { data: finished, error: finishError } = await rpc(
        "finish_notification_outbox",
        {
          p_outbox_id: item.outboxId,
          p_claim_token: item.claimToken,
          p_succeeded: true,
        },
      );
      if (finishError || finished !== true) throw new Error("finish_failed");
      return true;
    } catch (dispatchError) {
      const message = dispatchError instanceof Error ? dispatchError.message : "delivery_failed";
      await rpc("finish_notification_outbox", {
        p_outbox_id: item.outboxId,
        p_claim_token: item.claimToken,
        p_succeeded: false,
        p_error: message,
      });
      return false;
    }
  }));
  const delivered = outcomes.filter(Boolean).length;
  const failed = outcomes.length - delivered;

  return {
    status: failed === 0 ? "ok" as const : delivered === 0 ? "failed" as const : "partial" as const,
    delivered,
    failed,
  };
}

type SavedStatePayload = {
  title: string;
  shortId: string;
  oldState: string;
  newState: string;
  locale: "ko" | "en" | "ja" | "zh" | "zh-tw";
};

const STATE_LABELS: Record<SavedStatePayload["locale"], Record<string, string>> = {
  ko: { candidate: "관찰 중", rising: "급상승", trending: "유행 중", cooling: "식는 중", archive: "보관" },
  en: { candidate: "Candidate", rising: "Rising", trending: "Trending", cooling: "Cooling", archive: "Archive" },
  ja: { candidate: "観察中", rising: "急上昇", trending: "トレンド中", cooling: "下降中", archive: "アーカイブ" },
  zh: { candidate: "观察中", rising: "上升", trending: "流行中", cooling: "降温", archive: "归档" },
  "zh-tw": { candidate: "觀察中", rising: "上升", trending: "流行中", cooling: "降溫", archive: "封存" },
};

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function savedStatePayload(value: Json): SavedStatePayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const input = value as Record<string, Json | undefined>;
  const locale = input.locale;
  if (
    typeof input.title !== "string" || !input.title.trim() ||
    typeof input.short_id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(input.short_id) ||
    typeof input.old_state !== "string" || typeof input.new_state !== "string" ||
    (locale !== "ko" && locale !== "en" && locale !== "ja" && locale !== "zh" && locale !== "zh-tw")
  ) return null;
  return {
    title: input.title.trim().slice(0, 200),
    shortId: input.short_id,
    oldState: input.old_state,
    newState: input.new_state,
    locale,
  };
}

export function buildSavedStateChangeEmail(payload: SavedStatePayload, baseUrl = SITE_URL) {
  const oldState = STATE_LABELS[payload.locale][payload.oldState] ?? payload.oldState;
  const newState = STATE_LABELS[payload.locale][payload.newState] ?? payload.newState;
  const url = new URL(`/memes/${payload.shortId}`, baseUrl);
  url.searchParams.set("source", "saved_state_email");
  const subject = payload.locale === "ko"
    ? `저장한 밈 상태 변경: ${payload.title}`
    : `Saved meme update: ${payload.title}`;
  const text = `${payload.title}\n${oldState} → ${newState}\n${url}`;
  const html = `<p><strong>${escapeHtml(payload.title)}</strong></p><p>${escapeHtml(oldState)} → ${escapeHtml(newState)}</p><p><a href="${escapeHtml(url.toString())}">${escapeHtml(url.toString())}</a></p>`;
  return { subject, text, html };
}

export async function runSavedStateChangeEmails({
  admin,
  fetchImpl = fetch,
  deliveryUrl = process.env.PLUS_DIGEST_DELIVERY_URL,
  deliveryToken = process.env.PLUS_DIGEST_DELIVERY_TOKEN,
  fromEmail = process.env.PLUS_DIGEST_FROM_EMAIL,
}: {
  admin?: OutboxAdmin;
  fetchImpl?: typeof fetch;
  deliveryUrl?: string;
  deliveryToken?: string;
  fromEmail?: string;
} = {}) {
  if (!deliveryUrl || !fromEmail) {
    return { status: "not_configured" as const, delivered: 0, failed: 0 };
  }
  try {
    if (!/^https?:$/.test(new URL(deliveryUrl).protocol)) throw new Error("invalid_delivery_url");
  } catch {
    return { status: "not_configured" as const, delivered: 0, failed: 0 };
  }
  const client = admin ?? createAdminClient();

  return runNotificationOutbox({
    admin: client,
    claimRpc: "claim_saved_state_email_outbox",
    limit: 10,
    dispatchers: {
      email: async (item) => {
        if (!item.userId) throw new Error("recipient_missing");
        const payload = savedStatePayload(item.payload);
        if (!payload) throw new Error("invalid_payload");
        const user = await client.auth.admin.getUserById(item.userId);
        if (user.error) throw new Error("recipient_lookup_failed");
        const recipient = user.data.user?.email?.trim();
        if (!recipient) throw new Error("recipient_missing");
        const email = buildSavedStateChangeEmail(payload);
        const response = await fetchImpl(deliveryUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(deliveryToken ? { authorization: `Bearer ${deliveryToken}` } : {}),
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [recipient],
            ...email,
            idempotencyKey: item.outboxId,
            metadata: { outboxId: item.outboxId, topic: item.topic },
          }),
          signal: AbortSignal.timeout(8_000),
        });
        if (!response.ok) throw new Error(`provider_http_${response.status}`);
      },
    },
  });
}
