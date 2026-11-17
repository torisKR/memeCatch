import { afterEach, describe, expect, it } from "vitest";
import { getDeadlinePool, getPool } from "@/lib/db/pool";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

afterEach(async () => {
  await Promise.all([getPool().end(), getDeadlinePool().end()]);
  if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

describe("database pool bounds", () => {
  it("keeps the application pool unchanged and bounds only deadline reads", () => {
    process.env.DATABASE_URL = "postgresql://127.0.0.1:1/memecatch";

    const pool = getPool();
    const deadlinePool = getDeadlinePool();

    expect(pool.options.max).toBe(8);
    expect(pool.options.connectionTimeoutMillis).toBeUndefined();
    expect(pool.options.statement_timeout).toBeUndefined();
    expect(deadlinePool.options.max).toBe(2);
    expect(deadlinePool.options.connectionTimeoutMillis).toBe(1_500);
    expect(deadlinePool.options.statement_timeout).toBe(1_500);
  });
});
