import { describe, expect, it } from "vitest";

import { compileSelectPlan, rpcSql } from "@/lib/db/execute";
import { createPlanClient, type QueryPlan } from "@/lib/db/plan";

async function nestedTopicPlan(): Promise<QueryPlan> {
  const capture: { plan?: QueryPlan } = {};
  const client = createPlanClient(async (plan) => {
    capture.plan = plan;
    return { data: [], error: null, count: null };
  });
  await client
    .from("memes")
    .select("id,meme_tags_map(tag_id),topic_tags:meme_tags_map!inner(tags!inner(name))")
    .eq("topic_tags.tags.name", "AI 밈");
  if (!capture.plan) throw new Error("plan was not executed");
  return capture.plan;
}

describe("nested embedded SQL", () => {
  it("enforces every !inner level with nested EXISTS predicates", async () => {
    const plan = await nestedTopicPlan();
    const built = compileSelectPlan(plan, {
      columns: new Map([
        ["memes", new Map([["id", "uuid"]])],
        ["meme_tags_map", new Map([["meme_id", "uuid"], ["tag_id", "uuid"]])],
        ["tags", new Map([["id", "uuid"], ["name", "text"]])],
      ]),
      foreignKeys: [
        {
          name: "meme_tags_map_meme_id_fkey",
          srcTable: "meme_tags_map",
          srcCols: ["meme_id"],
          dstTable: "memes",
          dstCols: ["id"],
        },
        {
          name: "meme_tags_map_tag_id_fkey",
          srcTable: "meme_tags_map",
          srcCols: ["tag_id"],
          dstTable: "tags",
          dstCols: ["id"],
        },
      ],
      primaryKeys: new Map(),
    });

    expect(built.sql).not.toContain('"tags.name"');
    const rootWhere = built.sql.slice(
      built.sql.lastIndexOf('FROM public."memes" r1 WHERE '),
    );
    expect(rootWhere).toMatch(
      /EXISTS \(SELECT 1 FROM public\."meme_tags_map" r\d+ WHERE .*EXISTS \(SELECT 1 FROM public\."tags" r\d+ WHERE .*\."name" = \$\d+\)\)/,
    );
    expect(built.params).toContain("AI 밈");
  });
});

describe("search RPC SQL", () => {
  it("applies embedded content, filters, order and page to search results", async () => {
    let captured: QueryPlan | undefined;
    const client = createPlanClient(async (plan) => {
      captured = plan;
      return { data: [], error: null, count: null };
    });
    await client.rpc("search_memes", { p_query: "챌린지", p_limit: 50 })
      .select("id,title,meme_contents(url),matched_contents:meme_contents!inner(platform)")
      .eq("matched_contents.platform", "instagram")
      .order("id", { ascending: false }).range(5, 9);
    if (!captured) throw new Error("plan was not executed");
    const built = rpcSql(captured, { proretset: true, names: ["p_query", "p_limit"], types: ["text", "int4"] }, {
      columns: new Map([["memes", new Map([["id", "uuid"], ["title", "text"]])], ["meme_contents", new Map([["meme_id", "uuid"], ["url", "text"], ["platform", "text"]])]]),
      foreignKeys: [{ name: "meme_contents_meme_id_fkey", srcTable: "meme_contents", srcCols: ["meme_id"], dstTable: "memes", dstCols: ["id"] }],
      primaryKeys: new Map(),
    });
    expect(built.sql).toContain('FROM public."search_memes"(');
    expect(built.sql).toContain('AS "meme_contents"');
    expect(built.sql).toContain('EXISTS (SELECT 1 FROM public."meme_contents"');
    expect(built.sql).toMatch(/ORDER BY r1\."id" DESC LIMIT \$\d+::int OFFSET \$\d+::int/);
    expect(built.params.slice(0, 2)).toEqual(["챌린지", 50]);
    expect(built.params).toContain("instagram");
    expect(built.params.slice(-2)).toEqual([5, 5]);
  });
});
