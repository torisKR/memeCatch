import { describe, expect, it } from "vitest";

import { compileSelectPlan } from "@/lib/db/execute";
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
