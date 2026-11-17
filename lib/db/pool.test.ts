import { afterEach, describe, expect, it } from "vitest";
import { DB_POOL_ACQUIRE_TIMEOUT_MS, getPool } from "@/lib/db/pool";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

afterEach(async () => {
  await getPool().end();
  if (ORIGINAL_DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
});

describe("database pool bounds", () => {
  it("uses a finite checkout and connection timeout", () => {
    process.env.DATABASE_URL = "postgresql://127.0.0.1:1/memecatch";

    const pool = getPool();

    expect(pool.options.connectionTimeoutMillis).toBe(DB_POOL_ACQUIRE_TIMEOUT_MS);
    expect(DB_POOL_ACQUIRE_TIMEOUT_MS).toBe(1_500);
  });
});
