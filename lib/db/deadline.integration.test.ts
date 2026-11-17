import { afterAll, describe, expect, it } from "vitest";
import { executePlan, resetQueryMetadata } from "@/lib/db/execute";
import { DB_POOL_ACQUIRE_TIMEOUT_MS, getPool } from "@/lib/db/pool";

const databaseUrl = process.env.DATABASE_URL;
const anon = { userId: null, role: "anon" as const, anonymous: false };
const selectOneMeme = {
  op: "select" as const,
  table: "memes",
  fields: [{ kind: "column" as const, name: "id" }],
  filters: [],
  orGroups: [],
  orders: [],
  limit: 1,
  offset: null,
  single: false,
  maybeSingle: false,
  count: null,
  head: false,
  returning: true,
};

describe.skipIf(!databaseUrl)("database deadline enforcement", () => {
  afterAll(async () => {
    resetQueryMetadata();
    await getPool().end();
  });

  it("cancels a blocked plan query through PostgreSQL", async () => {
    resetQueryMetadata();
    const warm = await executePlan(selectOneMeme, anon);
    expect(warm.error).toBeNull();

    const blocker = await getPool().connect();
    try {
      await blocker.query("begin");
      await blocker.query("set local role service_role");
      await blocker.query("lock table public.memes in access exclusive mode");
      const startedAt = Date.now();
      const result = await executePlan(
        selectOneMeme,
        anon,
        AbortSignal.timeout(100),
      );

      expect(result.error?.code).toBe("57014");
      expect(result.error?.status).toBe(408);
      expect(Date.now() - startedAt).toBeLessThan(1_000);
    } finally {
      await blocker.query("rollback");
      blocker.release();
    }
  });

  it("rejects a queued pool checkout after the finite acquire timeout", async () => {
    const pool = getPool();
    const clients = await Promise.all(
      Array.from({ length: pool.options.max }, () => pool.connect()),
    );
    const startedAt = Date.now();
    try {
      await expect(pool.connect()).rejects.toThrow(
        "timeout exceeded when trying to connect",
      );
      const elapsed = Date.now() - startedAt;
      expect(elapsed).toBeGreaterThanOrEqual(DB_POOL_ACQUIRE_TIMEOUT_MS - 100);
      expect(elapsed).toBeLessThan(DB_POOL_ACQUIRE_TIMEOUT_MS + 1_500);
    } finally {
      for (const client of clients) client.release();
    }
  });
});
