import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "./migrations/20260812062435_fix_trend_rollup_integrity.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

describe("trend rollup integrity migration", () => {
  it("persists today's actual trend score and lets failures reach the caller", () => {
    expect(migration).toMatch(/update public\.meme_trend_metrics mt[\s\S]*set trend_score = m\.trend_score/i);
    expect(migration).not.toMatch(/exception when others|raise warning/i);
  });

  it("removes duplicate database schedulers in favor of the application sequence", () => {
    expect(migration).toMatch(/memecatch-daily-ranking/);
    expect(migration).toMatch(/memecatch-daily-trend-alerts/);
    expect(migration).toMatch(/memecatch-daily-saved-context-alerts/);
    expect(migration).not.toMatch(/cron\.schedule/i);
  });
});
