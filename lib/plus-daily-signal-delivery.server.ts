import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { SafetyLevel } from "@/lib/labels";
import { hasRequiredTranslationFields } from "@/lib/meme-translations";
import { parseUsageExamples } from "@/lib/usage-examples";
import {
  buildPlusDailySignalEmail,
  plusDailySignalSince,
  type DailySignalLocale,
  type PlusDailySignalCandidate,
} from "@/lib/plus-daily-signal.server";

type SignalMeme = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  usage_examples?: unknown;
  updated_at: string;
  lifecycle_status: string;
  moderation_status: string;
  safety_level: SafetyLevel;
};

export type PlusDailySignalAlertRow = {
  meme_id: string;
  kind: string;
  trend_score: number;
  created_at: string;
  memes: SignalMeme | null;
};

export type PlusDailySignalTranslationRow = {
  meme_id: string;
  locale: string;
  localized_slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  usage_examples?: unknown;
  status: string;
  source_updated_at: string;
};

type DeliveryRow = {
  delivery_id: string;
  user_id: string;
  delivery_date: string;
  locale: string;
  status: string;
};

type AdminClient = ReturnType<typeof createAdminClient>;

export type PlusDailySignalRunResult = {
  status: "ok" | "failed" | "not_configured";
  deliveryDate: string;
  queued: number;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  error?: string;
};

function sameInstant(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

export function isDailySignalLocale(value: string): value is DailySignalLocale {
  return value === "ko" || value === "en" || value === "ja" || value === "zh" || value === "zh-tw";
}

export function buildPlusDailySignalCandidates(
  locale: DailySignalLocale,
  alerts: readonly PlusDailySignalAlertRow[],
  translations: readonly PlusDailySignalTranslationRow[] = [],
): PlusDailySignalCandidate[] {
  const translationsByMeme = new Map(
    translations
      .filter((translation) => translation.locale === locale && translation.status === "reviewed")
      .map((translation) => [translation.meme_id, translation]),
  );
  const seen = new Set<string>();

  return alerts
    .filter((alert) => alert.kind === "rising" || alert.kind === "saved_rising")
    .filter((alert) => {
      const meme = alert.memes;
      return Boolean(
        meme &&
          (meme.moderation_status === "approved" || meme.moderation_status === "limited") &&
          meme.lifecycle_status === "rising" &&
          (meme.safety_level === "green" || meme.safety_level === "yellow"),
      );
    })
    .map((alert) => {
      const meme = alert.memes!;
      const translation = locale === "ko" ? null : translationsByMeme.get(meme.id);
      if (
        locale !== "ko" &&
        (!translation || !sameInstant(translation.source_updated_at, meme.updated_at))
      ) {
        return null;
      }
      const title = translation?.title.trim() || meme.title.trim();
      const summary = translation?.summary.trim() || meme.summary.trim();
      if (!title || !summary || seen.has(meme.id)) return null;
      seen.add(meme.id);
      const shareSource = translation ?? meme;
      const usageExamples = parseUsageExamples(shareSource.usage_examples);
      return {
        id: meme.id,
        shortId: meme.short_id,
        slug: translation?.localized_slug.trim() || meme.slug,
        title,
        summary,
        usageNote: shareSource.usage_note?.trim() || null,
        caution: shareSource.caution?.trim() || null,
        shareReady: hasRequiredTranslationFields(shareSource),
        trendScore: Number.isFinite(alert.trend_score) ? alert.trend_score : 0,
        safetyLevel: meme.safety_level,
        source: alert.kind === "saved_rising" ? "saved_rising" : "interest_rising",
        ...(usageExamples.length > 0 ? { usageExamples } : {}),
      } satisfies PlusDailySignalCandidate;
    })
    .filter((candidate): candidate is PlusDailySignalCandidate => candidate !== null)
    .sort(
      (left, right) =>
        (left.source === "saved_rising" ? 0 : 1) - (right.source === "saved_rising" ? 0 : 1) ||
        right.trendScore - left.trendScore ||
        left.id.localeCompare(right.id),
    )
    .slice(0, 3);
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

async function loadCandidates(
  admin: AdminClient,
  delivery: DeliveryRow,
  now: Date,
): Promise<PlusDailySignalCandidate[]> {
  if (!isDailySignalLocale(delivery.locale)) return [];
  const since = plusDailySignalSince(now);
  const { data: alertRows, error: alertError } = await admin
    .from("trend_alerts")
    .select(
      "meme_id, kind, trend_score, created_at, memes!inner(id, short_id, slug, title, summary, description, origin, usage_note, caution, usage_examples, updated_at, lifecycle_status, moderation_status, safety_level)",
    )
    .eq("user_id", delivery.user_id)
    .in("kind", ["rising", "saved_rising"])
    .gte("created_at", since)
    .order("trend_score", { ascending: false })
    .limit(30)
    .overrideTypes<PlusDailySignalAlertRow[], { merge: false }>();
  if (alertError) throw new Error("signal_query_failed");

  const alerts = alertRows ?? [];
  if (delivery.locale === "ko" || alerts.length === 0) {
    return buildPlusDailySignalCandidates(delivery.locale, alerts);
  }

  const memeIds = [...new Set(alerts.map((alert) => alert.meme_id))];
  const { data: translationRows, error: translationError } = await admin
    .from("meme_translations")
    .select(
      "meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution, usage_examples, status, source_updated_at",
    )
    .eq("locale", delivery.locale)
    .eq("status", "reviewed")
    .in("meme_id", memeIds)
    .overrideTypes<PlusDailySignalTranslationRow[], { merge: false }>();
  if (translationError) throw new Error("signal_translation_query_failed");

  return buildPlusDailySignalCandidates(delivery.locale, alerts, translationRows ?? []);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function providerMessageId(response: Response): Promise<string | null> {
  const body = await response.text();
  if (!body) return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (!isRecord(parsed)) return null;
    const value = parsed.id ?? parsed.messageId ?? parsed.message_id;
    return typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null;
  } catch {
    return null;
  }
}

async function deliverEmail(
  url: string,
  token: string | undefined,
  from: string,
  recipient: string,
  email: ReturnType<typeof buildPlusDailySignalEmail>,
  delivery: DeliveryRow,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; providerMessageId: string | null } | { ok: false; errorCode: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
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
          deliveryDate: delivery.delivery_date,
          locale: delivery.locale,
        },
      }),
      signal: controller.signal,
    });
    const messageId = await providerMessageId(response);
    return response.ok
      ? { ok: true, providerMessageId: messageId }
      : { ok: false, errorCode: `provider_http_${response.status}` };
  } catch (error) {
    return { ok: false, errorCode: error instanceof Error && error.name === "AbortError" ? "provider_timeout" : "provider_request_failed" };
  } finally {
    clearTimeout(timeout);
  }
}

type TerminalDeliveryStatus = "sent" | "failed" | "skipped";

async function finishDelivery(
  client: AdminClient,
  deliveryId: string,
  status: TerminalDeliveryStatus,
  errorCode: string | null,
  providerMessageId: string | null,
): Promise<boolean> {
  try {
    const { data, error } = await client.rpc("finish_plus_daily_signal_delivery", {
      p_delivery_id: deliveryId,
      p_status: status,
      p_error_code: errorCode,
      p_provider_message_id: providerMessageId,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

export async function runPlusDailySignal({
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
} = {}): Promise<PlusDailySignalRunResult> {
  const deliveryDate = seoulDate(now);
  const emptyResult = (status: PlusDailySignalRunResult["status"]): PlusDailySignalRunResult => ({
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

  const client = admin ?? createAdminClient();

  const { data: queued, error: queueError } = await client.rpc("queue_plus_daily_signal_deliveries", {
    p_delivery_date: deliveryDate,
  });
  if (queueError) return { ...emptyResult("failed"), error: "queue_failed" };

  const { data: claimedRows, error: claimError } = await client.rpc("claim_plus_daily_signal_deliveries", {
    p_delivery_date: deliveryDate,
    p_limit: 100,
  });
  if (claimError) return { ...emptyResult("failed"), queued: queued ?? 0, error: "claim_failed" };

  const result: PlusDailySignalRunResult = {
    status: "ok",
    deliveryDate,
    queued: queued ?? 0,
    claimed: claimedRows?.length ?? 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const delivery of (claimedRows ?? []) as DeliveryRow[]) {
    const user = await client.auth.admin.getUserById(delivery.user_id);
    const recipient = user.data.user?.email?.trim();
    if (!recipient) {
      const finished = await finishDelivery(
        client,
        delivery.delivery_id,
        "skipped",
        "recipient_missing",
        null,
      );
      result.skipped += 1;
      if (!finished) result.failed += 1;
      continue;
    }

    try {
      const candidates = await loadCandidates(client, delivery, now);
      if (candidates.length === 0) {
        const finished = await finishDelivery(
          client,
          delivery.delivery_id,
          "skipped",
          "no_current_signals",
          null,
        );
        result.skipped += 1;
        if (!finished) result.failed += 1;
        continue;
      }
      const email = buildPlusDailySignalEmail({
        locale: delivery.locale as DailySignalLocale,
        candidates,
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
      await finishDelivery(client, delivery.delivery_id, "failed", "signal_build_failed", null);
      result.failed += 1;
    }
  }

  if (result.failed > 0) result.status = "failed";
  return result;
}
