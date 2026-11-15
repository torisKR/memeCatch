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

describe("asJsonRows", () => {
  it("serializes rows in Postgres so timestamps keep their JSON text form", async () => {
    const { asJsonRows } = await import("@/lib/db/execute");
    expect(asJsonRows('SELECT "id" FROM public."memes" LIMIT 1')).toBe(
      'WITH __q AS (SELECT "id" FROM public."memes" LIMIT 1) SELECT row_to_json(__q) AS __row FROM __q',
    );
  });
});
