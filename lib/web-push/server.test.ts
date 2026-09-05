import {
  createDecipheriv,
  createECDH,
  createHmac,
  randomBytes,
} from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const createAdminClient = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { isSupportedWebPushEndpoint, runWebPushDelivery, sendWebPush } from "./server";

function hmac(key: Buffer, value: Buffer): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function expand(key: Buffer, info: string | Buffer, length: number): Buffer {
  return hmac(key, Buffer.concat([Buffer.from(info), Buffer.from([1])])).subarray(0, length);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("web push transport", () => {
  it("accepts browser push services and rejects private or disguised endpoints", () => {
    expect(isSupportedWebPushEndpoint("https://fcm.googleapis.com/fcm/send/one")).toBe(true);
    expect(isSupportedWebPushEndpoint("https://fcm.googleapis.com/wp/one")).toBe(true);
    expect(isSupportedWebPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/one")).toBe(true);
    expect(isSupportedWebPushEndpoint("https://web.push.apple.com/Q-one")).toBe(true);
    expect(isSupportedWebPushEndpoint("https://127.0.0.1/push")).toBe(false);
    expect(isSupportedWebPushEndpoint("https://fcm.googleapis.com.evil.test/push")).toBe(false);
    expect(isSupportedWebPushEndpoint("https://user@fcm.googleapis.com/push")).toBe(false);
    expect(isSupportedWebPushEndpoint("https://fcm.googleapis.com:8443/push")).toBe(false);
    expect(isSupportedWebPushEndpoint("https://fcm.googleapis.com/v1/projects/project/messages:send")).toBe(false);
    expect(isSupportedWebPushEndpoint("https://fcm.googleapis.com/push\n")).toBe(false);
  });

  it("rejects unsupported endpoints before the network sink", async () => {
    const subscriber = createECDH("prime256v1");
    subscriber.generateKeys();
    const vapid = createECDH("prime256v1");
    vapid.generateKeys();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWebPush({
      endpoint: "https://127.0.0.1/push",
      p256dh: subscriber.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    }, { title: "blocked" }, {
      publicKey: vapid.getPublicKey().toString("base64url"),
      privateKey: vapid.getPrivateKey().toString("base64url"),
      subject: "mailto:ops@example.test",
    })).rejects.toThrow("invalid_push_endpoint");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forbids redirects at the network sink", async () => {
    const subscriber = createECDH("prime256v1");
    subscriber.generateKeys();
    const vapid = createECDH("prime256v1");
    vapid.generateKeys();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.redirect).toBe("error");
      throw new TypeError("fetch failed: redirect mode is error");
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendWebPush({
      endpoint: "https://fcm.googleapis.com/fcm/send/redirect",
      p256dh: subscriber.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    }, { title: "redirect" }, {
      publicKey: vapid.getPublicKey().toString("base64url"),
      privateKey: vapid.getPrivateKey().toString("base64url"),
      subject: "mailto:ops@example.test",
    })).rejects.toThrow("redirect mode is error");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("sends an RFC 8291 encrypted payload with a VAPID token", async () => {
    const subscriber = createECDH("prime256v1");
    subscriber.generateKeys();
    const vapid = createECDH("prime256v1");
    vapid.generateKeys();
    const auth = randomBytes(16);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(null, { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendWebPush({
      endpoint: "https://fcm.googleapis.com/fcm/send/one",
      p256dh: subscriber.getPublicKey().toString("base64url"),
      auth: auth.toString("base64url"),
    }, {
      title: "급상승",
      body: "테스트 밈",
      url: "/memes/abc",
    }, {
      publicKey: vapid.getPublicKey().toString("base64url"),
      privateKey: vapid.getPrivateKey().toString("base64url"),
      subject: "mailto:ops@example.test",
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers["content-encoding"]).toBe("aes128gcm");
    expect(headers.authorization).toMatch(/^vapid t=[^.]+\.[^.]+\.[^,]+, k=/);
    const jwt = headers.authorization.match(/t=([^,]+)/)?.[1];
    const claims = JSON.parse(Buffer.from(jwt!.split(".")[1]!, "base64url").toString()) as { aud: string };
    expect(claims.aud).toBe("https://fcm.googleapis.com");
    expect(init?.redirect).toBe("error");

    const body = Buffer.from(init?.body as Buffer);
    const salt = body.subarray(0, 16);
    expect(body.readUInt32BE(16)).toBe(4096);
    const keyLength = body[20]!;
    const serverPublicKey = body.subarray(21, 21 + keyLength);
    const encrypted = body.subarray(21 + keyLength);
    const sharedSecret = subscriber.computeSecret(serverPublicKey);
    const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), subscriber.getPublicKey(), serverPublicKey]);
    const inputKey = expand(hmac(auth, sharedSecret), keyInfo, 32);
    const pseudoRandomKey = hmac(salt, inputKey);
    const contentKey = expand(pseudoRandomKey, "Content-Encoding: aes128gcm\0", 16);
    const nonce = expand(pseudoRandomKey, "Content-Encoding: nonce\0", 12);
    const decipher = createDecipheriv("aes-128-gcm", contentKey, nonce);
    decipher.setAuthTag(encrypted.subarray(-16));
    const clear = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
    expect(clear.at(-1)).toBe(2);
    expect(JSON.parse(clear.subarray(0, -1).toString())).toMatchObject({ title: "급상승", url: "/memes/abc" });
  });

  it("delivers the claimed batch concurrently within the per-request timeout", async () => {
    const subscriber = createECDH("prime256v1");
    subscriber.generateKeys();
    const vapid = createECDH("prime256v1");
    vapid.generateKeys();
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/batch",
      p256dh: subscriber.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    };
    const rpc = vi.fn(async (name: string) => {
      if (name === "enqueue_web_push_trend_alerts") return { data: 2, error: null };
      if (name === "claim_web_push_outbox") return {
        data: ["one", "two"].map((id) => ({
          outbox_id: id,
          user_id: id,
          payload: { title: id, url: `/memes/${id}` },
          claim_token: `claim-${id}`,
          attempt_count: 1,
        })),
        error: null,
      };
      return { data: true, error: null };
    });
    createAdminClient.mockReturnValue({
      rpc,
      from: () => ({
        select: () => ({ eq: async () => ({ data: [subscription], error: null }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
    });
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapid.getPublicKey().toString("base64url"));
    vi.stubEnv("VAPID_PRIVATE_KEY", vapid.getPrivateKey().toString("base64url"));
    vi.stubEnv("VAPID_SUBJECT", "mailto:ops@example.test");
    let active = 0;
    let peak = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 0));
      active -= 1;
      return new Response(null, { status: 201 });
    }));

    await expect(runWebPushDelivery(5)).resolves.toMatchObject({
      status: "ok",
      queued: 2,
      delivered: 2,
      failed: 0,
    });
    expect(peak).toBe(2);
    expect(rpc).toHaveBeenCalledWith("claim_web_push_outbox", { p_limit: 5 });
  });

  it("bounds the claimed batch and legacy subscription fan-out", async () => {
    const subscriber = createECDH("prime256v1");
    subscriber.generateKeys();
    const vapid = createECDH("prime256v1");
    vapid.generateKeys();
    const subscriptions = Array.from({ length: 8 }, (_, index) => ({
      endpoint: `https://fcm.googleapis.com/fcm/send/${index}`,
      p256dh: subscriber.getPublicKey().toString("base64url"),
      auth: randomBytes(16).toString("base64url"),
    }));
    const rpc = vi.fn(async (name: string) => name === "claim_web_push_outbox"
      ? { data: [{ outbox_id: "one", user_id: "user", payload: { title: "one" }, claim_token: "claim", attempt_count: 1 }], error: null }
      : { data: name === "enqueue_web_push_trend_alerts" ? 1 : true, error: null });
    createAdminClient.mockReturnValue({
      rpc,
      from: () => ({
        select: () => ({ eq: async () => ({ data: subscriptions, error: null }) }),
        delete: () => ({ eq: async () => ({ error: null }) }),
      }),
    });
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", vapid.getPublicKey().toString("base64url"));
    vi.stubEnv("VAPID_PRIVATE_KEY", vapid.getPrivateKey().toString("base64url"));
    vi.stubEnv("VAPID_SUBJECT", "mailto:ops@example.test");
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await runWebPushDelivery(1_000);

    expect(rpc).toHaveBeenCalledWith("claim_web_push_outbox", { p_limit: 25 });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});
