"use client";

import { createPlanClient, type QueryPlan } from "@/lib/db/plan";
import type { DbAuthResult } from "@/lib/db/types";

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

export function createClient() {
  const database = createPlanClient(postPlan);
  return {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    auth: {
      async getUser(): DbAuthResult<{ user: SessionUser | null }> {
        const session = await readSession().catch(() => null);
        return { data: { user: session?.user ?? null }, error: null };
      },
      async getSession(): DbAuthResult<{ session: { user: SessionUser } | null }> {
        const session = await readSession().catch(() => null);
        return { data: { session }, error: null };
      },
      async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }): DbAuthResult<{ url: string } | null> {
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
  };
}
