import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261028130000_affiliate_seasonal_source.sql"),
  "utf8",
);

describe("affiliate seasonal source migration", () => {
  it("allows seasonal rows without dropping the synced feeds", () => {
    expect(sql).toContain("check (source_type in ('hotdeal', 'recommend', 'seasonal'))");
    expect(sql).not.toMatch(/delete\s+from/i);
    expect(sql).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
  });
});
