import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const script = fileURLToPath(
  new URL("./affiliate_hotdeals_concurrency.sh", import.meta.url),
);

function runHarness(environment: Record<string, string>) {
  return spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      NODE_ENV: process.env.NODE_ENV ?? "test",
      PATH: process.env.PATH ?? "",
      ...environment,
    },
  });
}

describe("affiliate hotdeal concurrency harness guards", () => {
  it("requires an explicit destructive-test opt in before connecting", () => {
    const result = runHarness({
      TEST_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:54322/affiliate_sync_test_guard",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "ALLOW_DESTRUCTIVE_AFFILIATE_DB_TEST=1 is required",
    );
  });

  it("rejects non-loopback database hosts before connecting", () => {
    const result = runHarness({
      ALLOW_DESTRUCTIVE_AFFILIATE_DB_TEST: "1",
      TEST_DATABASE_URL:
        "postgresql://postgres:postgres@db.example.com:5432/affiliate_sync_test_guard",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("database host must be loopback");
  });

  it("rejects databases without the disposable-test name prefix", () => {
    const result = runHarness({
      ALLOW_DESTRUCTIVE_AFFILIATE_DB_TEST: "1",
      TEST_DATABASE_URL:
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      "database name must start with affiliate_sync_test_",
    );
  });
});
