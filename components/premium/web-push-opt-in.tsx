"use client";

import { useEffect, useState } from "react";
import {
  getCurrentWebPushSubscription,
  subscribeToWebPush,
  supportsWebPush,
  unsubscribeFromWebPush,
} from "@/lib/web-push/client";

type SubscriptionState = {
  signedIn: boolean;
  plus: boolean;
  enabled: boolean;
  publicKey: string;
};

export function WebPushOptIn() {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supportsWebPush()) return;
    Promise.all([
      fetch("/api/web-push/subscription", { cache: "no-store" }).then((response) => response.json()),
      getCurrentWebPushSubscription(),
    ])
      .then(([value, local]: [SubscriptionState, PushSubscription | null]) =>
        setState({ ...value, enabled: value.enabled && local !== null }))
      .catch(() => setError("알림 설정을 불러오지 못했습니다."));
  }, []);

  if (!supportsWebPush()) return null;
  if (!state?.signedIn || !state.plus || !state.publicKey) return null;

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const subscription = await subscribeToWebPush(state!.publicKey);
      const response = await fetch("/api/web-push/subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error("subscribe_failed");
      setState((current) => current ? { ...current, enabled: true } : current);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "permission_denied"
        ? "브라우저 알림 권한이 필요합니다."
        : "알림을 켜지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const endpoint = (await getCurrentWebPushSubscription())?.endpoint;
      if (!endpoint) throw new Error("subscription_missing");
      const response = await fetch("/api/web-push/subscription", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      if (!response.ok) throw new Error("unsubscribe_failed");
      await unsubscribeFromWebPush();
      setState((current) => current ? { ...current, enabled: false } : current);
    } catch {
      setError("알림을 끄지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5" aria-labelledby="web-push-title">
      <h2 id="web-push-title" className="text-base font-bold">급상승 알림</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        저장하거나 관심 등록한 밈이 급상승할 때 브라우저 알림을 받습니다. 같은 밈은 24시간에 한 번만 알려드려요.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={state.enabled ? disable : enable}
        className="mt-4 min-h-11 rounded-xl bg-accent-strong px-4 text-sm font-bold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        {busy ? "처리 중…" : state.enabled ? "브라우저 알림 끄기" : "브라우저 알림 켜기"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </section>
  );
}
