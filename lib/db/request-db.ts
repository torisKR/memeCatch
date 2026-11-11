import type { NextRequest } from "next/server";
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { executePlan } from "@/lib/db/execute";
import { createPlanClient } from "@/lib/db/plan";
import type { DbIdentity } from "@/lib/db/pool";

type RequestUser = { id: string; email?: string | null; is_anonymous: boolean } | null;

export async function createRequestDb(request: NextRequest) {
  let user: RequestUser = null;
  let broken = false;
  try {
    await ensureAuthSchema();
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (session?.user) user = { id: session.user.id, email: session.user.email, is_anonymous: false };
  } catch {
    broken = true;
  }
  const identity: DbIdentity = user
    ? { userId: user.id, role: "authenticated", anonymous: false }
    : { userId: null, role: "anon", anonymous: false };
  const database = createPlanClient(async (plan, signal) => {
    if (broken) return { data: null, error: { message: "database unavailable", status: 503 }, count: null };
    return executePlan(plan, identity, signal);
  });
  return {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    auth: {
      async getUser() {
        if (broken) return { data: { user: null }, error: { message: "database unavailable", status: 503 } };
        return { data: { user }, error: null };
      },
    },
  };
}
