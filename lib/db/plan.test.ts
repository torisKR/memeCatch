import { describe, expect, it } from "vitest";
import { parseOrFilter, quoteIdent } from "@/lib/db/plan";

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
});
