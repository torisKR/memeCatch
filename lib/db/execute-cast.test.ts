import { describe, expect, it } from "vitest";
import { castFor } from "@/lib/db/execute";

describe("castFor", () => {
  it("casts float and numeric arrays so double precision[] function args resolve", () => {
    expect(castFor("_float8", [0.1, 0.2])).toBe("::double precision[]");
    expect(castFor("_float4", [0.1])).toBe("::double precision[]");
    expect(castFor("_numeric", [1])).toBe("::numeric[]");
  });

  it("keeps existing array casts", () => {
    expect(castFor("_uuid", ["a"])).toBe("::uuid[]");
    expect(castFor("_int4", [1])).toBe("::bigint[]");
    expect(castFor("_text", ["a"])).toBe("::text[]");
  });
});

describe("normalizeRow", () => {
  it("turns top-level Date values into ISO strings and leaves other values alone", async () => {
    const { normalizeRow } = await import("@/lib/db/execute");
    const row = { id: "a", updated_at: new Date("2026-11-15T09:00:00Z"), n: 1, embed: { created_at: "2026-01-01T00:00:00+00:00" } };
    const out = normalizeRow(row);
    expect(out.updated_at).toBe("2026-11-15T09:00:00.000Z");
    expect(out.embed).toBe(row.embed);
    expect(row.updated_at).toBeInstanceOf(Date);
    const plain = { id: "b" };
    expect(normalizeRow(plain)).toBe(plain);
  });
});
