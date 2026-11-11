import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { CompiledQuery } from "kysely";
import { ensureAuthSchema } from "@/lib/auth/server";
import { syncAuthUser } from "@/lib/auth/sync-user";
import { getPool, withIdentity } from "@/lib/db/pool";
import { createAdminClient } from "@/lib/supabase/admin-client";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("service_role better auth lookups", () => {
  const id = randomUUID();
  const email = `grant-${id.slice(0, 8)}@example.test`;
  const authId = randomUUID();

  afterAll(async () => {
    await getPool().query('DELETE FROM public."user" WHERE id = $1', [id]);
  });

  it("reads the user table as service_role and does not confirm an unverified email", async () => {
    await ensureAuthSchema();
    await getPool().query(
      `INSERT INTO public."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, false, now(), now())`,
      [id, "grant check", email],
    );

    const looked = await createAdminClient().auth.admin.getUserById(id);
    expect(looked.error).toBeNull();
    expect(looked.data.user?.email).toBe(email);

    await expect(withIdentity(
      { userId: null, role: "anon", anonymous: false },
      async (trx) => {
        await trx.executeQuery(CompiledQuery.raw('SELECT id FROM public."user" LIMIT 1'));
      },
    )).rejects.toThrow(/permission denied/);

    await syncAuthUser({
      id: authId,
      email: `unconfirmed-${authId.slice(0, 8)}@example.test`,
      name: "unconfirmed",
      emailVerified: false,
    });
    const confirmed = await getPool().query<{ email_confirmed_at: Date | null }>(
      "SELECT email_confirmed_at FROM auth.users WHERE id = $1",
      [authId],
    );
    expect(confirmed.rows[0]?.email_confirmed_at).toBeNull();
  });
});
