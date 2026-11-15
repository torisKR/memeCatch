import { describe, expectTypeOf, it } from "vitest";
import type { Database } from "@/lib/database.types";
import type { DbClient, ParseFields } from "@/lib/db/types";

type Memes = Database["public"]["Tables"]["memes"]["Row"];

declare const db: DbClient;

describe("DbClient select typing", () => {
  it("picks plain columns and aliases from the row", () => {
    expectTypeOf<ParseFields<"memes", "id, title, name:slug">>().toEqualTypeOf<{
      id: Memes["id"];
      title: Memes["title"];
      name: Memes["slug"];
    }>();
  });

  it("types a reverse FK embed as an array and a forward !inner embed as an object", () => {
    type Saved = ParseFields<"saved_memes", "created_at, memes!inner(id, title)">;
    expectTypeOf<Saved["memes"]>().toEqualTypeOf<{ id: string; title: string }>();

    type WithSources = ParseFields<"memes", "id, meme_sources(source_url)">;
    expectTypeOf<WithSources["meme_sources"]>().toEqualTypeOf<{ source_url: string | null }[]>();
  });

  it("returns arrays, single rows, and optional rows by mode", async () => {
    if (typeof db === "undefined") return;
    const many = await db.from("memes").select("id");
    if (!many.error) expectTypeOf(many.data).toEqualTypeOf<{ id: string }[]>();

    const one = await db.from("memes").select("id").single();
    if (!one.error) expectTypeOf(one.data).toEqualTypeOf<{ id: string }>();

    const maybe = await db.from("memes").select("id").maybeSingle();
    if (!maybe.error) expectTypeOf(maybe.data).toEqualTypeOf<{ id: string } | null>();
  });

  it("types rpc rows and selects from them", async () => {
    if (typeof db === "undefined") return;
    const result = await db.rpc("search_memes", { p_query: "x" }).select("id, title");
    if (!result.error) expectTypeOf(result.data).toEqualTypeOf<{ id: string; title: string }[]>();
  });
});
