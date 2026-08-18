import "server-only";

import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign,
} from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

type PushSubscription = { endpoint: string; p256dh: string; auth: string };
type PushMessage = { title: string; body?: string; url?: string; tag?: string };
type ErrorValue = { message: string } | null;
type RpcResult = PromiseLike<{ data: unknown; error: ErrorValue }>;
type Rpc = (name: string, args?: Record<string, unknown>) => RpcResult;
type SubscriptionQuery = {
  select(columns: string): { eq(column: string, value: string): PromiseLike<{
    data: PushSubscription[] | null;
    error: ErrorValue;
  }> };
  delete(): { eq(column: string, value: string): PromiseLike<{ error: ErrorValue }> };
};
type Admin = { rpc: Rpc; from(table: string): SubscriptionQuery };

type ClaimedPush = {
  outbox_id: string;
  user_id: string;
  payload: unknown;
  claim_token: string;
  attempt_count: number;
};

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function hmac(key: Buffer, value: Buffer): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function expand(prk: Buffer, info: Buffer, length: number): Buffer {
  return hmac(prk, Buffer.concat([info, Buffer.from([1])])).subarray(0, length);
}

function encodePayload(payload: PushMessage, subscription: PushSubscription) {
  const clientPublicKey = Buffer.from(subscription.p256dh, "base64url");
  const authSecret = Buffer.from(subscription.auth, "base64url");
  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 4 || authSecret.length !== 16) {
    throw new Error("invalid_subscription_keys");
  }

  const server = createECDH("prime256v1");
  server.generateKeys();
  const serverPublicKey = server.getPublicKey();
  const sharedSecret = server.computeSecret(clientPublicKey);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0"),
    clientPublicKey,
    serverPublicKey,
  ]);
  const inputKey = expand(hmac(authSecret, sharedSecret), keyInfo, 32);
  const salt = randomBytes(16);
  const pseudoRandomKey = hmac(salt, inputKey);
  const contentKey = expand(pseudoRandomKey, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = expand(pseudoRandomKey, Buffer.from("Content-Encoding: nonce\0"), 12);
  const plainText = Buffer.concat([Buffer.from(JSON.stringify(payload)), Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const encrypted = Buffer.concat([cipher.update(plainText), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([
    salt,
    recordSize,
    Buffer.from([serverPublicKey.length]),
    serverPublicKey,
    encrypted,
  ]);
}

function vapidToken(endpoint: string, config: VapidConfig): string {
  const publicKey = Buffer.from(config.publicKey, "base64url");
  const privateKey = Buffer.from(config.privateKey, "base64url");
  if (publicKey.length !== 65 || publicKey[0] !== 4 || privateKey.length !== 32) {
    throw new Error("invalid_vapid_keys");
  }
  if (!config.subject.startsWith("mailto:") && !config.subject.startsWith("https://")) {
    throw new Error("invalid_vapid_subject");
  }

  const header = base64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = base64url(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 43_200,
    sub: config.subject,
  }));
  const unsigned = `${header}.${claims}`;
  const key = createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: publicKey.subarray(1, 33).toString("base64url"),
      y: publicKey.subarray(33).toString("base64url"),
      d: privateKey.toString("base64url"),
    },
    format: "jwk",
  });
  const signature = sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `${unsigned}.${signature.toString("base64url")}`;
}

function readConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}

function pushMessage(value: unknown): PushMessage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (typeof payload.title !== "string") return null;
  return {
    title: payload.title,
    body: typeof payload.body === "string" ? payload.body : undefined,
    url: typeof payload.url === "string" ? payload.url : undefined,
    tag: typeof payload.tag === "string" ? payload.tag : undefined,
  };
}

export async function sendWebPush(
  subscription: PushSubscription,
  payload: PushMessage,
  config: VapidConfig,
): Promise<Response> {
  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      authorization: `vapid t=${vapidToken(subscription.endpoint, config)}, k=${config.publicKey}`,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: "86400",
      urgency: "normal",
    },
    body: encodePayload(payload, subscription),
    signal: AbortSignal.timeout(10_000),
  });
}

export async function runWebPushDelivery(limit = 5) {
  const config = readConfig();
  if (!config) return { status: "failed" as const, queued: 0, delivered: 0, failed: 0, error: "vapid_not_configured" };

  const admin = createAdminClient() as unknown as Admin;
  const { data: queued, error: enqueueError } = await admin.rpc("enqueue_web_push_trend_alerts");
  if (enqueueError) return { status: "failed" as const, queued: 0, delivered: 0, failed: 0, error: "enqueue_failed" };

  const { data, error: claimError } = await admin.rpc("claim_web_push_outbox", { p_limit: limit });
  if (claimError) return { status: "failed" as const, queued: Number(queued ?? 0), delivered: 0, failed: 0, error: "claim_failed" };

  const outcomes = await Promise.all(((data ?? []) as ClaimedPush[]).map(async (item) => {
    const payload = pushMessage(item.payload);
    const { data: subscriptions, error: subscriptionError } = await admin
      .from("web_push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", item.user_id);

    let deliveryError: string | null = subscriptionError?.message ?? (payload ? null : "invalid_payload");
    let liveSubscriptions = 0;
    if (!deliveryError) {
      const subscriptionOutcomes = await Promise.all((subscriptions ?? []).map(async (subscription) => {
        try {
          const response = await sendWebPush(subscription, payload!, config);
          if (response.status === 404 || response.status === 410) {
            await admin.from("web_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
            return null;
          }
          if (!response.ok) throw new Error(`push_${response.status}`);
          return true;
        } catch (cause) {
          return cause instanceof Error ? cause.message : "push_failed";
        }
      }));
      liveSubscriptions = subscriptionOutcomes.filter((outcome) => outcome === true).length;
      deliveryError = subscriptionOutcomes.find((outcome) => typeof outcome === "string") ?? null;
    }

    const succeeded = deliveryError === null || (liveSubscriptions > 0);
    const { data: finished, error: finishError } = await admin.rpc("finish_notification_outbox", {
      p_outbox_id: item.outbox_id,
      p_claim_token: item.claim_token,
      p_succeeded: succeeded,
      p_error: succeeded ? null : deliveryError,
      p_retry_at: succeeded ? null : new Date(Date.now() + 300_000).toISOString(),
    });
    if (finishError || finished !== true) {
      return false;
    } else if (succeeded) {
      return true;
    } else {
      return false;
    }
  }));
  const delivered = outcomes.filter(Boolean).length;
  const failed = outcomes.length - delivered;

  return {
    status: failed === 0 ? "ok" as const : delivered === 0 ? "failed" as const : "partial" as const,
    queued: Number(queued ?? 0),
    delivered,
    failed,
  };
}
