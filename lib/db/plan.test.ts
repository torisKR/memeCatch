import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createPlanClient, parseOrFilter, quoteIdent, type QueryPlan } from "@/lib/db/plan";

describe("query plan", () => {
  it("turns PostgREST or() stars into SQL wildcards", () => {
    expect(parseOrFilter("title.ilike.*중꺾*,summary.ilike.*중꺾*")).toEqual([
      { column: "title", op: "ilike", value: "%중꺾%", negate: false },
      { column: "summary", op: "ilike", value: "%중꺾%", negate: false },
    ]);
  });

  it("parses is.null and not.is.null", () => {
    expect(parseOrFilter("last_checked_at.is.null,last_checked_at.not.is.null")).toEqual([
      { column: "last_checked_at", op: "is", value: null, negate: false },
      { column: "last_checked_at", op: "is", value: null, negate: true },
    ]);
  });

  it("rejects identifiers that could escape the query", () => {
    expect(() => quoteIdent("memes;drop")).toThrow(/invalid identifier/);
    expect(quoteIdent("meme_contents")).toBe('"meme_contents"');
  });

  it("executes overrideTypes the same way returns does", async () => {
    let seen: QueryPlan | undefined;
    const client = createPlanClient(async (plan) => {
      seen = plan;
      return { data: [{ id: "row-1" }], error: null, count: null };
    });

    const result = await client
      .from("memes")
      .select("id")
      .eq("short_id", "rk3w632x")
      .overrideTypes<{ id: string }[]>();

    expect(seen?.op).toBe("select");
    expect(seen?.table).toBe("memes");
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: "row-1" }]);
  });

  it("raises search p_limit to the requested page and folds 꺽 into 꺾", async () => {
    let seen: QueryPlan | undefined;
    const client = createPlanClient(async (plan) => {
      seen = plan;
      return { data: [], error: null, count: null };
    });

    await client
      .rpc("search_memes", { p_query: "중꺽마", p_limit: 50 })
      .range(48, 71);

    expect(seen?.offset).toBe(48);
    expect(seen?.limit).toBe(24);
    expect(seen?.args).toEqual({ p_query: "중꺾마", p_limit: 72 });
  });

  it("does not cap search_memes at 50 rows and folds the misspelling in SQL", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20261111100000_search_page_range.sql"),
      "utf8",
    );
    expect(migration).toContain("replace(coalesce(p_query, ''), '꺽', '꺾')");
    expect(migration).toContain("least(greatest(coalesce(p_limit, 20), 0), 5000)");
    expect(migration).not.toContain("least(p_limit, 50)");
  });
});
