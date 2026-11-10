import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cacheCatalogRead } from "@/lib/catalog-read-cache";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/supabase/public-catalog-cache";

class CatalogFailure extends Error {
  readonly code = "meme_catalog_unavailable";
}

describe("cacheCatalogRead", () => {
  it("runs the read when the Next data cache is not installed", async () => {
    const read = cacheCatalogRead(
      async (id: string) => ({ id }),
      ["catalog-read-test"],
      { revalidate: 86_400, tags: [PUBLIC_CATALOG_CACHE_TAG] },
    );
    await expect(read("meme-1")).resolves.toEqual({ id: "meme-1" });
  });

  it("does not turn a catalog failure into an empty cached value", async () => {
    const read = cacheCatalogRead(
      async () => {
        throw new CatalogFailure();
      },
      ["catalog-read-failure"],
      { revalidate: 86_400, tags: [PUBLIC_CATALOG_CACHE_TAG] },
    );
    await expect(read()).rejects.toBeInstanceOf(CatalogFailure);
  });

  it("stores successful detail reads on the shared catalog tag and leaves failures thrown", () => {
    const source = readFileSync(join(process.cwd(), "lib/queries.ts"), "utf8");
    const detail = source.slice(source.indexOf("async function fetchMemeByShortId"));
    expect(detail.startsWith("async function fetchMemeByShortId")).toBe(true);
    expect(detail).toContain("if (error) throw new MemeCatalogUnavailableError()");
    expect(detail).toContain("if (!data) return null");
    expect(detail.indexOf("if (error) throw new MemeCatalogUnavailableError()")).toBeLessThan(
      detail.indexOf("if (!data) return null"),
    );
    expect(source).toContain("cacheCatalogRead(");
    expect(source).toContain("tags: [PUBLIC_CATALOG_CACHE_TAG]");
    const stream = readFileSync(join(process.cwd(), "components/continue-stream.tsx"), "utf8");
    expect(stream).toContain("LIST_SELECT");
    expect(stream).not.toContain('select("*"');
    expect(stream).not.toContain("select=*,");
    expect(stream).toContain("if (error) throw new MemeCatalogUnavailableError()");
  });
});
