import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260818125100_growth_kpi_dashboard.sql",
  "utf8",
);

describe("growth KPI dashboard migration", () => {
  it("fails closed when the baseline or denominator is incomplete", () => {
    expect(sql).toMatch(/when not coalesce\(p_coverage_complete, false\)/);
    expect(sql).toMatch(/when coalesce\(p_denominator, 0\) = 0/);
    expect(sql).toMatch(/public\.growth_kpi_unavailable\('baseline_missing'\)/);
    expect(sql).toMatch(/v_baseline\.coverage_start <= v_baseline\.period_end - interval '60 days'/);
    expect(sql).toContain("coalesce(event.session_id::text, event.user_id::text)");
    expect(sql).not.toContain("coalesce(event.user_id::text, event.session_id::text)");
  });

  it("derives every requested KPI from durable events without mutating product state", () => {
    for (const event of [
      "meme_view",
      "follow_click",
      "copy",
      "paywall_view",
      "checkout_start",
      "payment_confirmed",
      "renewal",
    ]) {
      expect(sql).toContain(`'${event}'`);
    }
    expect(sql).not.toMatch(/update public\./i);
    expect(sql).not.toMatch(/insert into public\./i);
    expect(sql).not.toMatch(/delete from public\./i);
  });

  it("keeps the dashboard operator-only", () => {
    expect(sql).toMatch(/if not public\.is_operator\(\) then/);
    expect(sql).toMatch(/revoke all on function public\.get_growth_kpi_dashboard\(\)/);
    expect(sql).toMatch(/grant execute on function public\.get_growth_kpi_dashboard\(\) to authenticated/);
  });
});
