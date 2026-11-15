import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260825090000_mpe_job_lease_heartbeat.sql"),
  "utf8",
);

describe("MPE processing job lease heartbeat migration", () => {
  it("renews only the active lease and exposes renewal only to service role", () => {
    expect(sql).toMatch(
      /create or replace function public\.renew_processing_job_lease\([\s\S]*p_job_id uuid,[\s\S]*p_lease_token uuid/,
    );
    expect(sql).toMatch(
      /set started_at = now\(\)[\s\S]*job\.id = p_job_id[\s\S]*job\.status = 'running'[\s\S]*job\.lease_token = p_lease_token/,
    );
    expect(sql).toContain("message = 'job_not_running'");
    expect(sql).toContain("message = 'lease_token_mismatch'");
    expect(sql).toMatch(
      /revoke all on function public\.renew_processing_job_lease\(uuid, uuid\)[\s\S]*from public, anon, authenticated/,
    );
    expect(sql).toMatch(
      /grant execute on function public\.renew_processing_job_lease\(uuid, uuid\)[\s\S]*to service_role/,
    );
  });
});
