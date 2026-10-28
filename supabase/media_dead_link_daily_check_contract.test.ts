import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261028120000_media_dead_link_daily_check.sql"),
  "utf8",
);

describe("media dead link daily check migration", () => {
  it("installs one daily enqueue and one bounded tick schedule", () => {
    expect(sql).toMatch(/where jobname in \(\s+'memecatch-media-dead-link-daily',\s+'memecatch-media-dead-link-tick'\s+\)/);
    expect(sql).toMatch(/cron\.schedule\(\s+'memecatch-media-dead-link-daily',\s+'0 18 \* \* \*'/);
    expect(sql).toMatch(/cron\.schedule\(\s+'memecatch-media-dead-link-tick',\s+'\*\/2 \* \* \* \*'/);
    expect(sql).toContain("limit 150");
    expect(sql).not.toMatch(/delete\s+from\s+cron\.job/i);
  });

  it("only calls the fixed YouTube oEmbed host with GET and no credentials", () => {
    expect(sql).toContain("check (check_url ~ '^https://www\\.youtube\\.com/oembed\\?')");
    expect(sql).toContain("check (platform = 'youtube')");
    expect(sql).toContain("net.http_get(");
    expect(sql).not.toContain("net.http_post(");
    expect(sql).not.toContain("vault.");
    expect(sql).not.toMatch(/Authorization/);
  });

  it("requires repeated failures and a healthy run before marking dead", () => {
    expect(sql).toContain("consecutive_failures >= 2");
    expect(sql).toContain("status = 'tripped'");
    expect(sql).toContain("v_run.ok_count < 20");
    expect(sql).toContain("when r.status_code = 401 then 'ok'");
    expect(sql).toContain("when r.status_code in (400, 403, 404) then 'unplayable'");
    expect(sql).toMatch(/else 'error'/);
  });

  it("never touches house originals and records every change for restore", () => {
    expect(sql.match(/origin_kind is distinct from 'house_original'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql).toContain("insert into media_health_private.content_marks");
    expect(sql).toContain("insert into media_health_private.source_marks");
    expect(sql).toContain("previous_availability::public.availability_status");
    expect(sql).toContain("ms.removed_at = restored.marked_removed_at");
    expect(sql).not.toMatch(/delete\s+from\s+public\./i);
    expect(sql).not.toMatch(/update\s+public\.memes\b/i);
  });

  it("keeps scheduler objects private to postgres and service role", () => {
    expect(sql).toContain("revoke all on schema media_health_private from public, anon, authenticated, service_role;");
    for (const name of ["enqueue_daily_check", "process_check_tick"]) {
      expect(sql).toMatch(new RegExp(
        "revoke all on function media_health_private\\." + name + "\\(\\)\\s+from public, anon, authenticated, service_role;",
      ));
    }
    expect(sql).toContain("security definer");
  });
});
