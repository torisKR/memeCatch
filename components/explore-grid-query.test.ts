import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { buildMemesQuery, type ExploreFilters } from "@/components/explore-grid";

type Call = { method: string; args: unknown[] };

function recorder() {
  const calls: Call[] = [];
  const chain: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_target, property) =>
        (...args: unknown[]) => {
          calls.push({ method: String(property), args });
          return chain;
        },
    }
  );
  const client = {
    from: (...args: unknown[]) => {
      calls.push({ method: "from", args });
      return chain;
    },
    rpc: (...args: unknown[]) => {
      calls.push({ method: "rpc", args });
      return chain;
    },
  } as unknown as SupabaseClient<Database>;
  return { calls, client };
}

function filters(platform?: ExploreFilters["platform"]): ExploreFilters {
  return { categories: [], platform, sort: "trending" };
}

function hasCall(calls: Call[], method: string, ...args: unknown[]) {
  return calls.some(
    (call) =>
      call.method === method &&
      args.every((arg, index) => call.args[index] === arg)
  );
}

describe("explore platform query", () => {
  it("keeps the all-platform query as an outer content relation", () => {
    const { calls, client } = recorder();
    buildMemesQuery(client, filters());

    const select = calls.find((call) => call.method === "select")?.args[0];
    expect(select).toContain("meme_contents(");
    expect(select).not.toContain("meme_contents!inner");
    expect(hasCall(calls, "eq", "meme_contents.moderation_status", "approved")).toBe(false);
  });

  it("excludes Shorts from the regular YouTube filter", () => {
    const { calls, client } = recorder();
    buildMemesQuery(client, filters("youtube"));

    expect(calls.find((call) => call.method === "select")?.args[0]).toContain(
      "meme_contents!inner"
    );
    expect(hasCall(calls, "eq", "meme_contents.moderation_status", "approved")).toBe(true);
    expect(hasCall(calls, "neq", "meme_contents.availability", "dead")).toBe(true);
    expect(hasCall(calls, "ilike", "meme_contents.platform", "youtube")).toBe(true);
    expect(hasCall(calls, "not", "meme_contents.url", "ilike", "%/shorts/%")).toBe(true);
  });

  it("requires a Shorts URL for the Shorts filter", () => {
    const { calls, client } = recorder();
    buildMemesQuery(client, filters("youtube_shorts"));

    expect(hasCall(calls, "ilike", "meme_contents.platform", "youtube")).toBe(true);
    expect(hasCall(calls, "ilike", "meme_contents.url", "%/shorts/%")).toBe(true);
    expect(calls.some((call) => call.method === "not")).toBe(false);
  });
});
