import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261013150000_trend_evidence_scheduler.sql"),
  "utf8",
);

describe("trend evidence scheduler migration", () => {
  it("dispatches only to the fixed production GET route when its vault secret exists", () => {
    expect(sql).toContain("create or replace function trend_scheduler_private.dispatch_trend_discovery()");
    expect(sql).toContain("from vault.decrypted_secrets");
    expect(sql).toContain("where name = 'memecatch_trend_cron_secret'");
    expect(sql).toMatch(/if nullif\(btrim\(v_token\), ''\) is null then\s+return null;/);
    expect(sql).toContain("url := 'https://catchmeme.com/api/cron/trend-discovery'");
    expect(sql).toContain("'Authorization', 'Bearer ' || v_token");
    expect(sql).toContain("timeout_milliseconds := 60000");
    expect(sql).toContain("net.http_get(");
    expect(sql).not.toContain("net.http_post(");
    expect(sql).not.toContain("vault.create_secret");
  });

  it("retries only a due failed or expired current-window lease", () => {
    expect(sql).toContain("create or replace function trend_scheduler_private.retry_trend_discovery()");
    expect(sql).toContain("date_bin(");
    expect(sql).toContain("interval '6 hours'");
    expect(sql).toContain("'youtube:new_discovery:' || v_bucket_key");
    expect(sql).toContain("'youtube:candidate_tracking:' || v_bucket_key");
    expect(sql).toContain("pg_try_advisory_xact_lock(");
    expect(sql).toMatch(/status = 'running'\s+and lease_expires_at > now\(\)/);
    expect(sql).toContain("attempt_count < 3");
    expect(sql).toMatch(/status = 'failed' and retry_after <= now\(\)/);
    expect(sql).toMatch(/status = 'running' and lease_expires_at <= now\(\)/);
  });

  it("installs only the two stable named schedules", () => {
    expect(sql).toMatch(/where jobname in \(\s+'memecatch-trend-discovery',\s+'memecatch-trend-discovery-retry'\s+\)/);
    expect(sql).toMatch(/cron\.schedule\(\s+'memecatch-trend-discovery',\s+'0 \*\/6 \* \* \*'/);
    expect(sql).toMatch(/cron\.schedule\(\s+'memecatch-trend-discovery-retry',\s+'\*\/5 \* \* \* \*'/);
    expect(sql).not.toMatch(/delete\s+from\s+cron\.job/i);
  });

  it("keeps scheduler functions private to postgres and service role", () => {
    expect(sql).toContain("security definer");
    expect(sql).toMatch(/revoke all on schema trend_scheduler_private from public, anon, authenticated, service_role;/);
    for (const name of ["dispatch_trend_discovery", "retry_trend_discovery"]) {
      expect(sql).toMatch(new RegExp(
        `revoke all on function trend_scheduler_private\\.${name}\\(\\)\\s+from public, anon, authenticated, service_role;`,
      ));
      expect(sql).toMatch(new RegExp(
        `grant execute on function trend_scheduler_private\\.${name}\\(\\)\\s+to service_role;`,
      ));
    }
  });
});
