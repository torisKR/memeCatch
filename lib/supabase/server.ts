import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import type { Database } from "@/lib/database.types";
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { verifyMagicLink } from "@/lib/auth/magic-link";
import { hashNewPassword } from "@/lib/auth/passwords";
import { executePlan } from "@/lib/db/execute";
import { createPlanClient } from "@/lib/db/plan";
import { getPool, type DbIdentity } from "@/lib/db/pool";

type SessionUser = { id: string; email: string; name?: string | null; is_anonymous?: boolean };

function identityFor(user: SessionUser | null): DbIdentity {
  if (!user) return { userId: null, role: "anon", anonymous: false };
  return { userId: user.id, role: "authenticated", anonymous: user.is_anonymous === true };
}

async function currentSession(): Promise<SessionUser | null> {
  await ensureAuthSchema();
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return { id: session.user.id, email: session.user.email, name: session.user.name, is_anonymous: false };
}

function authApi(loadUser: () => Promise<SessionUser | null>) {
  return {
    async getUser() {
      try {
        const user = await loadUser();
        return { data: { user }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    },
    async getSession() {
      const user = await loadUser().catch(() => null);
      return { data: { session: user ? { user } : null }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        await ensureAuthSchema();
        await getAuth().api.signInEmail({ body: { email, password }, headers: await headers() });
        return { data: { session: { access_token: "cookie" }, user: null }, error: null };
      } catch {
        return { data: { session: null, user: null }, error: { message: "invalid credentials" } };
      }
    },
    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: { nickname?: string } } }) {
      try {
        await ensureAuthSchema();
        await getAuth().api.signUpEmail({
          body: { email, password, name: options?.data?.nickname ?? "밈러" },
          headers: await headers(),
        });
        return { data: { session: null, user: null }, error: null };
      } catch {
        return { data: { session: null, user: null }, error: { message: "signup failed" } };
      }
    },
    async signOut() {
      try {
        await getAuth().api.signOut({ headers: await headers() });
        return { error: null };
      } catch {
        return { error: null };
      }
    },
    async resetPasswordForEmail(email: string) {
      try {
        await ensureAuthSchema();
        await getAuth().api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
      } catch {
        // The caller always shows the same notice.
      }
      return { data: {}, error: null };
    },
    async updateUser({ password }: { password: string }) {
      try {
        const user = await loadUser();
        if (!user) return { data: { user: null }, error: { message: "no session" } };
        const hash = await hashNewPassword(password);
        await getPool().query(
          `UPDATE account SET password = $1, "updatedAt" = now()
            WHERE "userId" = $2 AND "providerId" = 'credential'`,
          [hash, user.id],
        );
        return { data: { user }, error: null };
      } catch (error) {
        return { data: { user: null }, error: { message: error instanceof Error ? error.message : "password update failed" } };
      }
    },
    async exchangeCodeForSession() {
      return { data: { session: null }, error: { message: "oauth code exchange is handled by /api/auth" } };
    },
    async verifyOtp({ token_hash }: { token_hash: string; type: string }) {
      try {
        const user = await verifyMagicLink(token_hash, await headers());
        if (!user) return { data: { user: null, session: null }, error: { message: "invalid token" } };
        return { data: { user, session: { access_token: "cookie" } }, error: null };
      } catch (error) {
        return { data: { user: null, session: null }, error: { message: error instanceof Error ? error.message : "invalid token" } };
      }
    },
    onAuthStateChange(callback: (event: string, session: { user: SessionUser } | null) => void) {
      void loadUser()
        .then((user) => callback(user ? "SIGNED_IN" : "SIGNED_OUT", user ? { user } : null))
        .catch(() => callback("SIGNED_OUT", null));
      return { data: { subscription: { unsubscribe() {} } } };
    },
  };
}

export async function createClient(): Promise<SupabaseClient<Database>> {
  const user = await currentSession().catch(() => null);
  const identity = identityFor(user);
  const database = createPlanClient((plan, signal) => executePlan(plan, identity, signal));
  return {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    auth: authApi(async () => user ?? currentSession().catch(() => null)),
  } as unknown as SupabaseClient<Database>;
}

/** Public reads. The old PostgREST response cache is not used on this path. */
export function createStaticClient(options: { cachePublicCounts?: boolean; cachePublicCatalog?: boolean } = {}): SupabaseClient<Database> {
  void options;
  const identity: DbIdentity = { userId: null, role: "anon", anonymous: false };
  const database = createPlanClient((plan, signal) => executePlan(plan, identity, signal));
  return {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    auth: authApi(async () => null),
  } as unknown as SupabaseClient<Database>;
}
