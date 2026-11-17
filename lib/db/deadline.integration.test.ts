import { afterAll, describe, expect, it } from "vitest";
import { executeDeadlinePlan, executePlan, resetQueryMetadata } from "@/lib/db/execute";
import { getDeadlinePool, getPool } from "@/lib/db/pool";

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
    await Promise.all([getPool().end(), getDeadlinePool().end()]);
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

  it("preserves same-pool fire-and-forget cancellation for general queries", async () => {
    resetQueryMetadata();
    const warm = await executePlan(selectOneMeme, anon);
    expect(warm.error).toBeNull();

    const pool = getPool();
    const blocker = await pool.connect();
    const fillers = await Promise.all(
      Array.from({ length: pool.options.max - 2 }, () => pool.connect()),
    );
    try {
      await blocker.query("begin");
      await blocker.query("set local role service_role");
      await blocker.query("lock table public.memes in access exclusive mode");

      const controller = new AbortController();
      const running = executePlan(selectOneMeme, anon, controller.signal);
      const occupiedDeadline = Date.now() + 500;
      while (pool.idleCount !== 0 && Date.now() < occupiedDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(pool.totalCount).toBe(pool.options.max);
      expect(pool.idleCount).toBe(0);

      controller.abort();
      const queuedDeadline = Date.now() + 500;
      while (pool.waitingCount !== 1 && Date.now() < queuedDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(pool.waitingCount).toBe(1);

      await blocker.query("rollback");
      const result = await running;
      expect([null, "57014"]).toContain(result.error?.code ?? null);

      const drainedDeadline = Date.now() + 500;
      while (pool.waitingCount !== 0 && Date.now() < drainedDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(pool.waitingCount).toBe(0);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      for (const client of fillers) client.release();
    }
  });

  it("keeps deadline-bound public reads independent from a full general pool", async () => {
    resetQueryMetadata();
    const pool = getPool();
    const clients = await Promise.all(
      Array.from({ length: pool.options.max }, () => pool.connect()),
    );
    try {
      const generalResultPromise = executePlan(
        selectOneMeme,
        anon,
        AbortSignal.timeout(1_000),
      );
      const queuedDeadline = Date.now() + 500;
      while (pool.waitingCount !== 1 && Date.now() < queuedDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(pool.waitingCount).toBe(1);

      const startedAt = Date.now();
      const result = await executeDeadlinePlan(selectOneMeme, anon, AbortSignal.timeout(1_000));
      expect(result.error).toBeNull();
      expect(result.data).toEqual(expect.any(Array));
      expect(Date.now() - startedAt).toBeLessThan(1_000);
      expect(pool.waitingCount).toBe(1);

      clients.pop()?.release();
      const generalResult = await generalResultPromise;
      expect(generalResult.error).toBeNull();
      expect(generalResult.data).toEqual(expect.any(Array));
    } finally {
      for (const client of clients) client.release();
    }
  });

  it("keeps general reads independent from cold metadata queued in a full deadline pool", async () => {
    resetQueryMetadata();
    const deadlinePool = getDeadlinePool();
    const clients = await Promise.all(
      Array.from({ length: deadlinePool.options.max }, () => deadlinePool.connect()),
    );
    try {
      const deadlineResultPromise = executeDeadlinePlan(
        selectOneMeme,
        anon,
        AbortSignal.timeout(1_000),
      );
      const queuedDeadline = Date.now() + 500;
      while (deadlinePool.waitingCount !== 1 && Date.now() < queuedDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      expect(deadlinePool.waitingCount).toBe(1);

      const startedAt = Date.now();
      const generalResult = await executePlan(
        selectOneMeme,
        anon,
        AbortSignal.timeout(1_000),
      );
      expect(generalResult.error).toBeNull();
      expect(generalResult.data).toEqual(expect.any(Array));
      expect(Date.now() - startedAt).toBeLessThan(1_000);
      expect(deadlinePool.waitingCount).toBe(1);

      clients.pop()?.release();
      const deadlineResult = await deadlineResultPromise;
      expect(deadlineResult.error).toBeNull();
      expect(deadlineResult.data).toEqual(expect.any(Array));
    } finally {
      for (const client of clients) client.release();
    }
  });

  it("uses the server deadline while the general pool is full and recovers", async () => {
    resetQueryMetadata();
    const warm = await executeDeadlinePlan(selectOneMeme, anon);
    expect(warm.error).toBeNull();

    const pool = getPool();
    const blocker = await pool.connect();
    const fillers = await Promise.all(
      Array.from({ length: pool.options.max - 1 }, () => pool.connect()),
    );
    try {
      await blocker.query("begin");
      await blocker.query("set local role service_role");
      await blocker.query("lock table public.memes in access exclusive mode");

      const startedAt = Date.now();
      const result = await executeDeadlinePlan(selectOneMeme, anon, AbortSignal.timeout(100));
      const elapsed = Date.now() - startedAt;
      expect(result.error?.code).toBe("57014");
      expect(result.error?.status).toBe(408);
      expect(elapsed).toBeGreaterThanOrEqual(1_200);
      expect(elapsed).toBeLessThan(2_200);
    } finally {
      await blocker.query("rollback");
      blocker.release();
      for (const client of fillers) client.release();
    }

    const recovered = await executeDeadlinePlan(selectOneMeme, anon);
    expect(recovered.error).toBeNull();
    expect(recovered.data).toEqual(expect.any(Array));
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
});
