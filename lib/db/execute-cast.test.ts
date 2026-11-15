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
