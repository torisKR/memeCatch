"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createPlanClient, type QueryPlan } from "@/lib/db/plan";

type SessionUser = { id: string; email?: string | null; is_anonymous?: boolean };

async function postPlan(plan: QueryPlan, signal?: AbortSignal) {
  const response = await fetch("/api/db/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ plan }),
    signal,
  });
  return response.json();
}

async function readSession(): Promise<{ user: SessionUser } | null> {
  const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) return null;
  const body = (await response.json()) as { user?: SessionUser | null } | null;
  return body?.user ? { user: { ...body.user, is_anonymous: false } } : null;
}

export function createClient(): SupabaseClient<Database> {
  const database = createPlanClient(postPlan);
  return {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    auth: {
      async getUser() {
        const session = await readSession().catch(() => null);
        return { data: { user: session?.user ?? null }, error: null };
      },
      async getSession() {
        const session = await readSession().catch(() => null);
        return { data: { session }, error: null };
      },
      async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }) {
        const response = await fetch("/api/auth/sign-in/social", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            provider,
            callbackURL: options?.redirectTo ?? "/",
            disableRedirect: true,
          }),
        });
        const body = (await response.json().catch(() => null)) as { url?: string; message?: string } | null;
        if (!response.ok || !body?.url) return { data: null, error: { message: body?.message ?? "oauth unavailable" } };
        window.location.assign(body.url);
        return { data: { url: body.url }, error: null };
      },
      async signInWithWeb3({ wallet, statement }: { chain: "ethereum"; statement: string; wallet: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }) {
        const accounts = (await wallet.request({ method: "eth_requestAccounts" })) as string[];
        const address = accounts[0];
        if (!address) return { data: { session: null }, error: { message: "wallet account missing" } };
        const nonce = await fetch("/api/auth/kaia", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ address, statement }),
        });
        const issued = (await nonce.json().catch(() => null)) as { message?: string } | null;
        if (!nonce.ok || !issued?.message) return { data: { session: null }, error: { message: "kaia challenge failed" } };
        const signature = await wallet.request({ method: "personal_sign", params: [issued.message, address] });
        const login = await fetch("/api/auth/kaia", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ address, message: issued.message, signature }),
        });
        if (!login.ok) return { data: { session: null }, error: { message: "kaia sign-in failed" } };
        return { data: { session: { access_token: "cookie" } }, error: null };
      },
      onAuthStateChange(callback: (event: string, session: { user: SessionUser } | null) => void) {
        let active = true;
        void readSession()
          .then((session) => {
            if (active) callback(session ? "SIGNED_IN" : "SIGNED_OUT", session);
          })
          .catch(() => {
            if (active) callback("SIGNED_OUT", null);
          });
        return { data: { subscription: { unsubscribe() { active = false; } } } };
      },
    },
  } as unknown as SupabaseClient<Database>;
}
