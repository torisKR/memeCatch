import { afterEach, describe, expect, it } from "vitest";
import {
  DB_CANCEL_CONNECTION_TIMEOUT_MS,
  getCancelPool,
  getDeadlinePool,
  getPool,
} from "@/lib/db/pool";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

afterEach(async () => {
  await Promise.all([getPool().end(), getCancelPool().end(), getDeadlinePool().end()]);
  if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

describe("database pool bounds", () => {
  it("reserves the finite checkout timeout for cancellation connections", () => {
    process.env.DATABASE_URL = "postgresql://127.0.0.1:1/memecatch";

    const pool = getPool();
    const cancelPool = getCancelPool();
    const deadlinePool = getDeadlinePool();

    expect(pool.options.connectionTimeoutMillis).toBeUndefined();
    expect(cancelPool.options.max).toBe(1);
    expect(cancelPool.options.connectionTimeoutMillis).toBe(DB_CANCEL_CONNECTION_TIMEOUT_MS);
    expect(cancelPool.options.query_timeout).toBe(1_000);
    expect(deadlinePool.options.max).toBe(2);
    expect(deadlinePool.options.connectionTimeoutMillis).toBe(1_500);
    expect(DB_CANCEL_CONNECTION_TIMEOUT_MS).toBe(1_500);
  });
});
