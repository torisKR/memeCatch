import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";
import type { DailySignalLocale } from "@/lib/plus-daily-signal.server";

type DeliveryRow = {
  delivery_id: string;
  user_id: string;
  current_period_end: string;
  reminder_days: 7 | 3 | 1 | 0;
  locale: string;
  status: string;
};

type RpcResult = { data: unknown; error: unknown };
type AdminClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  auth: {
    admin: {
      getUserById: (userId: string) => Promise<{
        data: { user: { email?: string | null } | null };
        error?: unknown;
      }>;
    };
  };
};

type ExpiryEmail = { subject: string; text: string; html: string };

const PLUS_EXPIRY_REMINDER_BATCH_SIZE = 100;
const PLUS_EXPIRY_REMINDER_CONCURRENCY = 20;
const PLUS_EXPIRY_REMINDER_TIMEOUT_MS = 8_000;

export type PlusExpiryReminderRunResult = {
  status: "ok" | "failed" | "not_configured";
  deliveryDate: string;
  queued: number;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  error?: string;
};

const COPY: Record<DailySignalLocale, {
  subject: (days: number) => string;
  title: (days: number) => string;
  body: string;
  action: string;
}> = {
  ko: {
    subject: (days) => days === 0 ? "MemeCatch Plus가 오늘 만료돼요" : `MemeCatch Plus가 ${days}일 뒤 만료돼요`,
    title: (days) => days === 0 ? "Plus 이용권이 오늘 만료됩니다" : `Plus 이용권 만료까지 ${days}일 남았습니다`,
    body: "새 이용권을 결제하면 저장한 밈과 Plus 도구를 계속 사용할 수 있어요.",
    action: "Plus 이용 연장하기",
  },
  en: {
    subject: (days) => days === 0 ? "Your MemeCatch Plus pass expires today" : `Your MemeCatch Plus pass expires in ${days} days`,
    title: (days) => days === 0 ? "Your Plus pass expires today" : `${days} days left on your Plus pass`,
    body: "Buy another pass to keep your saved memes and Plus tools available.",
    action: "Extend Plus access",
  },
  ja: {
    subject: (days) => days === 0 ? "MemeCatch Plusは本日で期限切れです" : `MemeCatch Plusの期限まであと${days}日です`,
    title: (days) => days === 0 ? "Plus利用券は本日で期限切れです" : `Plus利用券の期限まであと${days}日です`,
    body: "新しい利用券を購入すると、保存したミームとPlusツールを引き続き利用できます。",
    action: "Plus利用を延長する",
  },
  zh: {
    subject: (days) => days === 0 ? "MemeCatch Plus 将于今天到期" : `MemeCatch Plus 将在 ${days} 天后到期`,
    title: (days) => days === 0 ? "Plus 使用权今天到期" : `Plus 使用权还剩 ${days} 天`,
    body: "购买新的使用权，即可继续使用收藏的迷因和 Plus 工具。",
    action: "延长 Plus 使用权",
  },
  "zh-tw": {
    subject: (days) => days === 0 ? "MemeCatch Plus 將於今天到期" : `MemeCatch Plus 將在 ${days} 天後到期`,
    title: (days) => days === 0 ? "Plus 使用權今天到期" : `Plus 使用權還剩 ${days} 天`,
    body: "購買新的使用權，即可繼續使用已儲存的迷因和 Plus 工具。",
    action: "延長 Plus 使用權",
  },
};

function isLocale(value: string): value is DailySignalLocale {
  return value === "ko" || value === "en" || value === "ja" || value === "zh" || value === "zh-tw";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function seoulDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function buildPlusExpiryReminderEmail({
  locale,
  reminderDays,
  baseUrl = SITE_URL,
}: {
  locale: DailySignalLocale;
  reminderDays: DeliveryRow["reminder_days"];
  baseUrl?: string;
}): ExpiryEmail {
  const copy = COPY[locale];
  const pricingPath = locale === "ko" ? "/pricing" : `/${locale}/pricing`;
  const checkoutUrl = new URL(pricingPath, baseUrl);
  checkoutUrl.searchParams.set("source", "expiry_reminder");
  const title = copy.title(reminderDays);
  const text = [title, copy.body, "", `${copy.action}: ${checkoutUrl}`].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif;"><main style="max-width:620px;margin:0 auto;padding:32px 20px;"><p style="margin:0 0 8px;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;">MemeCatch Plus</p><h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1><p style="margin:0 0 24px;line-height:1.6;">${escapeHtml(copy.body)}</p><a href="${escapeHtml(checkoutUrl.toString())}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#0f766e;color:#fff;font-weight:700;text-decoration:none;">${escapeHtml(copy.action)}</a></main></body></html>`;
  return { subject: copy.subject(reminderDays), text, html };
}

function providerMessageId(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const value = record.id ?? record.messageId ?? record.message_id;
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
}

async function deliverEmail(
  url: string,
  token: string | undefined,
  from: string,
  recipient: string,
  email: ExpiryEmail,
  delivery: DeliveryRow,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; providerMessageId: string | null } | { ok: false; errorCode: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLUS_EXPIRY_REMINDER_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: email.subject,
        text: email.text,
        html: email.html,
        idempotencyKey: delivery.delivery_id,
        metadata: {
          deliveryId: delivery.delivery_id,
          reminderDays: delivery.reminder_days,
          locale: delivery.locale,
        },
      }),
      signal: controller.signal,
    });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {}
    return response.ok
      ? { ok: true, providerMessageId: providerMessageId(body) }
      : { ok: false, errorCode: `provider_http_${response.status}` };
  } catch (error) {
    return {
      ok: false,
      errorCode: error instanceof Error && error.name === "AbortError"
        ? "provider_timeout"
        : "provider_request_failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function finishDelivery(
  admin: AdminClient,
  deliveryId: string,
  status: "sent" | "failed" | "skipped",
  errorCode: string | null,
  messageId: string | null,
): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc("finish_plus_expiry_reminder", {
      p_delivery_id: deliveryId,
      p_status: status,
      p_error_code: errorCode,
      p_provider_message_id: messageId,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function runPlusExpiryReminders({
  now = new Date(),
  admin,
  fetchImpl = fetch,
  deliveryUrl = process.env.PLUS_DIGEST_DELIVERY_URL,
  deliveryToken = process.env.PLUS_DIGEST_DELIVERY_TOKEN,
  fromEmail = process.env.PLUS_DIGEST_FROM_EMAIL,
}: {
  now?: Date;
  admin?: AdminClient;
  fetchImpl?: typeof fetch;
  deliveryUrl?: string;
  deliveryToken?: string;
  fromEmail?: string;
} = {}): Promise<PlusExpiryReminderRunResult> {
  const deliveryDate = seoulDate(now);
  const emptyResult = (status: PlusExpiryReminderRunResult["status"]): PlusExpiryReminderRunResult => ({
    status,
    deliveryDate,
    queued: 0,
    claimed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  });
  if (!deliveryUrl || !fromEmail) return emptyResult("not_configured");
  try {
    const parsedUrl = new URL(deliveryUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) return emptyResult("not_configured");
  } catch {
    return emptyResult("not_configured");
  }

  const client = admin ?? (createAdminClient() as unknown as AdminClient);
  const queuedResult = await client.rpc("queue_plus_expiry_reminders", {
    p_delivery_date: deliveryDate,
  });
  if (queuedResult.error) return { ...emptyResult("failed"), error: "queue_failed" };
  const claimedResult = await client.rpc("claim_plus_expiry_reminders", {
    p_delivery_date: deliveryDate,
    p_limit: PLUS_EXPIRY_REMINDER_BATCH_SIZE,
  });
  const queued = typeof queuedResult.data === "number" ? queuedResult.data : 0;
  if (claimedResult.error) return { ...emptyResult("failed"), queued, error: "claim_failed" };
  const deliveries = Array.isArray(claimedResult.data) ? claimedResult.data as DeliveryRow[] : [];
  const result: PlusExpiryReminderRunResult = {
    status: "ok",
    deliveryDate,
    queued,
    claimed: deliveries.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (let offset = 0; offset < deliveries.length; offset += PLUS_EXPIRY_REMINDER_CONCURRENCY) {
    await Promise.all(deliveries.slice(offset, offset + PLUS_EXPIRY_REMINDER_CONCURRENCY).map(async (delivery) => {
      try {
        const user = await client.auth.admin.getUserById(delivery.user_id);
        if (user.error) throw new Error("recipient_lookup_failed");
        const recipient = user.data.user?.email?.trim();
        if (!recipient || !isLocale(delivery.locale)) {
          const reason = recipient ? "unsupported_locale" : "recipient_missing";
          const finished = await finishDelivery(client, delivery.delivery_id, "skipped", reason, null);
          result.skipped += 1;
          if (!finished) result.failed += 1;
          return;
        }

        const email = buildPlusExpiryReminderEmail({
          locale: delivery.locale,
          reminderDays: delivery.reminder_days,
        });
        const sent = await deliverEmail(
          deliveryUrl,
          deliveryToken,
          fromEmail,
          recipient,
          email,
          delivery,
          fetchImpl,
        );
        if (sent.ok) {
          const finished = await finishDelivery(
            client,
            delivery.delivery_id,
            "sent",
            null,
            sent.providerMessageId,
          );
          if (finished) result.sent += 1;
          else result.failed += 1;
        } else {
          await finishDelivery(client, delivery.delivery_id, "failed", sent.errorCode, null);
          result.failed += 1;
        }
      } catch {
        await finishDelivery(client, delivery.delivery_id, "failed", "delivery_processing_failed", null);
        result.failed += 1;
      }
    }));
  }

  if (result.failed > 0) result.status = "failed";
  return result;
}
