import type { SupabaseClient } from "@supabase/supabase-js";
import { CompiledQuery } from "kysely";
import type { Database } from "@/lib/database.types";
import { generateMagicLink } from "@/lib/auth/magic-link";
import { hashNewPassword } from "@/lib/auth/passwords";
import { ensureAuthSchema } from "@/lib/auth/server";
import { executePlan } from "@/lib/db/execute";
import { createPlanClient, type PlanExecutor } from "@/lib/db/plan";
import { withIdentity, type DbIdentity } from "@/lib/db/pool";
import { objectStorage } from "@/lib/object-storage";

const SERVICE: DbIdentity = { userId: null, role: "service_role", anonymous: false };

type AuthRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  provider: string | null;
};

function mapAuthUser(row: AuthRow) {
  return {
    id: row.id,
    email: row.email,
    created_at: row.created_at,
    last_sign_in_at: row.last_sign_in_at,
    app_metadata: { provider: row.provider },
  };
}

async function queryAuth<T>(sqlText: string, params: unknown[]): Promise<T[]> {
  await ensureAuthSchema();
  return withIdentity(SERVICE, async (trx) => {
    const result = await trx.executeQuery<T>(CompiledQuery.raw(sqlText, params));
    return result.rows;
  });
}

const USER_SQL = `SELECT u.id::text AS id,
                         u.email,
                         u."createdAt" AS created_at,
                         (SELECT max(s."updatedAt") FROM session s WHERE s."userId" = u.id) AS last_sign_in_at,
                         (SELECT a."providerId" FROM account a WHERE a."userId" = u.id ORDER BY a."createdAt" LIMIT 1) AS provider
                    FROM "user" u`;

const execute: PlanExecutor = (plan, signal) => executePlan(plan, SERVICE, signal);

export function createAdminClient(): SupabaseClient<Database> {
  const database = createPlanClient(execute);
  return {
    from: database.from.bind(database),
    rpc: database.rpc.bind(database),
    storage: objectStorage(),
    auth: {
      admin: {
        async getUserById(userId: string) {
          try {
            const rows = await queryAuth<AuthRow>(`${USER_SQL} WHERE u.id = $1`, [userId]);
            const row = rows[0];
            if (!row) return { data: { user: null }, error: { message: "user not found", status: 404 } };
            return { data: { user: mapAuthUser(row) }, error: null };
          } catch (error) {
            return { data: { user: null }, error: { message: error instanceof Error ? error.message : "user lookup failed" } };
          }
        },
        async listUsers({ perPage }: { page?: number; perPage?: number } = {}) {
          try {
            const limit = Math.max(1, Math.min(perPage ?? 200, 1000));
            const rows = await queryAuth<AuthRow>(`${USER_SQL} ORDER BY u."createdAt" DESC LIMIT $1`, [limit]);
            return { data: { users: rows.map(mapAuthUser) }, error: null };
          } catch (error) {
            return { data: { users: [] }, error: { message: error instanceof Error ? error.message : "user list failed" } };
          }
        },
        async updateUserById(userId: string, attributes: { password?: string }) {
          try {
            if (!attributes.password) return { data: { user: null }, error: null };
            await ensureAuthSchema();
            const hash = await hashNewPassword(attributes.password);
            await queryAuth(
              `UPDATE account SET password = $1, "updatedAt" = now()
                WHERE "userId" = $2 AND "providerId" = 'credential'`,
              [hash, userId],
            );
            return { data: { user: { id: userId } }, error: null };
          } catch (error) {
            return { data: { user: null }, error: { message: error instanceof Error ? error.message : "password update failed" } };
          }
        },
        async generateLink(input: { type: string; email: string; options?: { data?: { nickname?: string } } }) {
          try {
            const token = await generateMagicLink(input.email, input.options?.data?.nickname ?? "틱톡러");
            return { data: { properties: { hashed_token: token } }, error: null };
          } catch (error) {
            return { data: { properties: null }, error: { message: error instanceof Error ? error.message : "link failed" } };
          }
        },
      },
    },
  } as unknown as SupabaseClient<Database>;
}
