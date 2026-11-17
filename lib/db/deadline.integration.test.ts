import { afterAll, describe, expect, it } from "vitest";
import { executeDeadlinePlan, executePlan, resetQueryMetadata } from "@/lib/db/execute";
import { getCancelPool, getDeadlinePool, getPool } from "@/lib/db/pool";

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
    await Promise.all([getPool().end(), getCancelPool().end(), getDeadlinePool().end()]);
  });

  it("cancels a blocked plan query while every general-pool slot is occupied", async () => {
    resetQueryMetadata();
    const warm = await executePlan(selectOneMeme, anon);
    expect(warm.error).toBeNull();

    const pool = getPool();
    const blocker = await pool.connect();
    const fillers = await Promise.all(
      Array.from({ length: pool.options.max - 2 }, () => pool.connect()),
    );
    let emergency: ReturnType<typeof setTimeout> | undefined;
    try {
      await blocker.query("begin");
      await blocker.query("set local role service_role");
      await blocker.query("lock table public.memes in access exclusive mode");
      const startedAt = Date.now();
      emergency = setTimeout(() => {
        void blocker.query("rollback");
      }, 1_000);
      const result = await executePlan(
        selectOneMeme,
        anon,
        AbortSignal.timeout(100),
      );

      expect(result.error?.code).toBe("57014");
      expect(result.error?.status).toBe(408);
      expect(Date.now() - startedAt).toBeLessThan(700);
    } finally {
      if (emergency) clearTimeout(emergency);
      await blocker.query("rollback");
      blocker.release();
      for (const client of fillers) client.release();
    }
  });

  it("does not impose the proxy checkout deadline on the shared application pool", async () => {
    const pool = getPool();
    const clients = await Promise.all(
      Array.from({ length: pool.options.max }, () => pool.connect()),
    );
    try {
      let settled = false;
      const queued = pool.connect().then((client) => {
        settled = true;
        return client;
      });
      await new Promise((resolve) => setTimeout(resolve, 1_600));
      expect(settled).toBe(false);
      expect(pool.waitingCount).toBe(1);
      clients.pop()?.release();
      const queuedClient = await queued;
      queuedClient.release();
    } finally {
      for (const client of clients) client.release();
    }
  });

  it("keeps deadline-bound public reads independent from a full general pool", async () => {
    resetQueryMetadata();
    const pool = getPool();
    const clients = await Promise.all(
      Array.from({ length: pool.options.max }, () => pool.connect()),
    );
    try {
      const startedAt = Date.now();
      const result = await executeDeadlinePlan(selectOneMeme, anon, AbortSignal.timeout(1_500));
      expect(result.error).toBeNull();
      expect(result.data).toEqual(expect.any(Array));
      expect(Date.now() - startedAt).toBeLessThan(1_500);
      expect(pool.waitingCount).toBe(0);
    } finally {
      for (const client of clients) client.release();
    }
  });

  it("keeps a shared metadata checkout alive when one pool-full waiter cancels", async () => {
    resetQueryMetadata();
    const pool = getPool();
    const clients = await Promise.all(
      Array.from({ length: pool.options.max }, () => pool.connect()),
    );
    const cancelled = new AbortController();
    try {
      const cancelledResultPromise = executePlan(selectOneMeme, anon, cancelled.signal);
      const activeResultPromise = executePlan(selectOneMeme, anon);

      const queuedDeadline = Date.now() + 500;
      while (pool.waitingCount !== 1 && Date.now() < queuedDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(pool.waitingCount).toBe(1);

      cancelled.abort();
      const cancelledResult = await cancelledResultPromise;
      expect(cancelledResult.error?.code).toBe("57014");
      expect(cancelledResult.error?.status).toBe(408);
      expect(pool.waitingCount).toBe(1);

      clients.pop()?.release();
      const activeResult = await activeResultPromise;
      expect(activeResult.error).toBeNull();
      expect(activeResult.data).toEqual(expect.any(Array));
    } finally {
      for (const client of clients) client.release();
    }
  });

  it("finishes a queued cancel attempt before reusing its backend for another query", async () => {
    resetQueryMetadata();
    const warm = await executePlan(selectOneMeme, anon);
    expect(warm.error).toBeNull();

    const pool = getPool();
    const blocker = await pool.connect();
    const fillers = await Promise.all(
      Array.from({ length: pool.options.max - 2 }, () => pool.connect()),
    );
    const cancelBlocker = getCancelPool().query("select pg_sleep(0.35)");
    try {
      await blocker.query("begin");
      await blocker.query("set local role service_role");
      await blocker.query("lock table public.memes in access exclusive mode");

      const controller = new AbortController();
      const first = executePlan(selectOneMeme, anon, controller.signal);
      await new Promise((resolve) => setTimeout(resolve, 50));
      controller.abort();
      await new Promise((resolve) => setTimeout(resolve, 50));
      await blocker.query("rollback");

      const firstResult = await first;
      expect(firstResult.error).toBeNull();

      await blocker.query("begin");
      await blocker.query("set local role service_role");
      await blocker.query("lock table public.memes in access exclusive mode");
      const release = setTimeout(() => {
        void blocker.query("rollback");
      }, 500);
      try {
        const secondResult = await executePlan(selectOneMeme, anon);
        expect(secondResult.error).toBeNull();
        expect(secondResult.data).toEqual(expect.any(Array));
      } finally {
        clearTimeout(release);
        await blocker.query("rollback");
      }
    } finally {
      await cancelBlocker.catch(() => undefined);
      await blocker.query("rollback");
      blocker.release();
      for (const client of fillers) client.release();
    }
  });

  it("stops a sent cancel-pool statement on the server before allowing subsequent work", async () => {
    const cancelPool = getCancelPool();
    const before = await cancelPool.query<{ pid: number }>("select pg_backend_pid() as pid");
    const startedAt = Date.now();
    let timeoutError: unknown;
    try {
      await cancelPool.query("select pg_sleep(2)");
    } catch (error) {
      timeoutError = error;
    }
    const timeoutElapsed = Date.now() - startedAt;
    expect(timeoutError).toMatchObject({ code: "57014" });
    expect(timeoutElapsed).toBeGreaterThanOrEqual(850);
    expect(timeoutElapsed).toBeLessThan(1_500);

    const reuseStartedAt = Date.now();
    const after = await cancelPool.query<{ pid: number }>("select pg_backend_pid() as pid");
    expect(Date.now() - reuseStartedAt).toBeLessThan(300);
    expect(after.rows[0]?.pid).not.toBe(before.rows[0]?.pid);
  });
});
