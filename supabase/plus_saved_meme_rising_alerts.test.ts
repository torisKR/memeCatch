import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("./migrations/20260808113000_plus_saved_meme_rising_alerts.sql", import.meta.url)),
  "utf8",
);

describe("Plus saved-meme rising alert migration contract", () => {
  it("adds the distinct saved_rising kind without weakening the existing kind constraint", () => {
    expect(migration).toMatch(/drop constraint if exists trend_alerts_kind_check/i);
    expect(migration).toMatch(/check \(kind in \('rising', 'saved_rising'\)\)/i);
  });

  it("derives recipients only from active Plus users and their own saved memes", () => {
    expect(migration).toMatch(/where public\.has_active_plus\(p\.id\)/);
    expect(migration).toMatch(/join public\.saved_memes sm on sm\.user_id = pu\.user_id/);
    expect(migration).toMatch(/join public\.memes m on m\.id = sm\.meme_id/);
    expect(migration).not.toMatch(/p_user_id|request\.user|input.*user_id/i);
  });

  it("keeps alerts bounded, idempotent, and avoids a duplicate generic alert for saved memes", () => {
    expect(migration).toMatch(/not exists \(\s*select 1\s*from public\.saved_memes sm/i);
    expect(migration).toMatch(/where rn <= 15/i);
    expect(migration).toMatch(/on conflict \(user_id, meme_id, kind\) do nothing/i);
    expect(migration).toMatch(/delete from public\.trend_alerts where created_at < now\(\) - interval '30 days'/i);
  });

  it("does not expose a new direct write path to browser roles", () => {
    expect(migration).toMatch(/revoke all on function public\.fan_out_trend_alerts\(\) from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.fan_out_trend_alerts\(\) to service_role/i);
  });

  it("runs the fan-out after the existing daily trend-score job", () => {
    expect(migration).toMatch(/cron\.unschedule\(jobid\)[\s\S]*jobname = 'memecatch-daily-trend-alerts'/i);
    expect(migration).toMatch(/cron\.schedule\([\s\S]*'memecatch-daily-trend-alerts'[\s\S]*'35 15 \* \* \*'[\s\S]*'select public\.fan_out_trend_alerts\(\);'/i);
    expect(migration).toMatch(/jobname = 'memecatch-daily-trend-alerts'[\s\S]*schedule = '35 15 \* \* \*'/i);
  });
});
