"use client";

export type WebPushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function applicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return new Uint8Array(bytes.buffer);
}

export function supportsWebPush(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined" &&
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getCurrentWebPushSubscription(): Promise<PushSubscription | null> {
  if (!supportsWebPush()) return null;
  return (await navigator.serviceWorker.ready).pushManager.getSubscription();
}

export async function subscribeToWebPush(publicKey: string): Promise<WebPushSubscriptionInput> {
  if (!supportsWebPush()) throw new Error("push_unsupported");
  const serverKey = applicationServerKey(publicKey);
  if (serverKey.length !== 65 || serverKey[0] !== 4) throw new Error("invalid_vapid_key");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("permission_denied");

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: serverKey,
  });
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error("invalid_subscription");
  }
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export async function unsubscribeFromWebPush(): Promise<string | null> {
  const subscription = await getCurrentWebPushSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
