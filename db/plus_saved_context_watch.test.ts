import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(new URL("./migrations/20260809090000_plus_saved_context_watch.sql", import.meta.url)),
  "utf8",
);

describe("Plus saved context watch migration contract", () => {
  it("records only public change categories and does not turn trend-score refreshes into content alerts", () => {
    expect(migration).toMatch(/create table if not exists public\.meme_public_change_events/i);
    expect(migration).toMatch(/'editorial_update'[\s\S]*'safety_update'[\s\S]*'translation_reviewed'[\s\S]*'translation_stale'[\s\S]*'lifecycle_update'/i);
    expect(migration).toMatch(/after update of title, summary, description, origin, usage_note, caution,[\s\S]*lifecycle_status, moderation_status/i);
    expect(migration).not.toMatch(/after update of[^\n]*trend_score/i);
  });

  it("fans out only to active Plus owners of the saved meme", () => {
    expect(migration).toMatch(/public\.has_active_plus\(sm\.user_id\)/i);
    expect(migration).toMatch(/join public\.meme_public_change_events e on e\.meme_id = sm\.meme_id/i);
    expect(migration).toMatch(/e\.created_at > sm\.created_at/i);
    expect(migration).toMatch(/where rn <= 30/i);
    expect(migration).toMatch(/on conflict \(user_id, event_id\) do nothing/i);
  });

  it("keeps browser writes closed and read marking self-scoped", () => {
    expect(migration).toMatch(/create policy plus_saved_context_alerts_self_read/i);
    expect(migration).toMatch(/using \(user_id = \(select auth\.uid\(\)\)\)/i);
    expect(migration).toMatch(/revoke all on function public\.fan_out_saved_context_alerts\(\) from public, anon, authenticated/i);
    expect(migration).toMatch(/grant execute on function public\.fan_out_saved_context_alerts\(\) to service_role/i);
    expect(migration).toMatch(/grant execute on function public\.mark_saved_context_alerts_read\(\) to authenticated/i);
    expect(migration).toMatch(/public\.has_active_plus\(v_uid\)/i);
  });

  it("schedules delivery after the daily trend work", () => {
    expect(migration).toMatch(/'memecatch-daily-saved-context-alerts'/i);
    expect(migration).toMatch(/'40 15 \* \* \*'/i);
    expect(migration).toMatch(/'select public\.fan_out_saved_context_alerts\(\);'/i);
  });
});
