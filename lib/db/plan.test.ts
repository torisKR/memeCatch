import { describe, expect, it } from "vitest";
import {
  attachDottedFilters,
  createPlanClient,
  parseOrFilter,
  quoteIdent,
  type QueryPlan,
} from "@/lib/db/plan";

async function capturePlan(build: (client: ReturnType<typeof createPlanClient>) => PromiseLike<unknown>) {
  const capture: { plan?: QueryPlan } = {};
  const client = createPlanClient(async (plan) => {
    capture.plan = plan;
    return { data: [], error: null, count: null };
  });
  await build(client);
  if (!capture.plan) throw new Error("plan was not executed");
  return capture.plan;
}

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

  it("attaches a nested dotted filter to the exact embedded relation", async () => {
    const plan = await capturePlan((client) =>
      client
        .from("memes")
        .select("meme_tags_map(tag_id),topic_tags:meme_tags_map!inner(tags!inner(name))")
        .eq("topic_tags.tags.name", "AI 밈"),
    );

    attachDottedFilters(plan);

    expect(plan.filters).toEqual([]);
    const topic = plan.fields[1];
    expect(topic?.kind).toBe("embed");
    if (topic?.kind !== "embed") return;
    expect(topic.embed.filters).toEqual([]);
    const tags = topic.embed.fields[0];
    expect(tags?.kind).toBe("embed");
    if (tags?.kind !== "embed") return;
    expect(tags.embed.filters).toEqual([
      { column: "name", op: "eq", value: "AI 밈" },
    ]);
  });

  it("keeps one-level dotted filters on their direct embed", async () => {
    const plan = await capturePlan((client) =>
      client
        .from("memes")
        .select("meme_contents!inner(platform)")
        .eq("meme_contents.platform", "youtube"),
    );

    attachDottedFilters(plan);

    const contents = plan.fields[0];
    expect(contents?.kind).toBe("embed");
    if (contents?.kind !== "embed") return;
    expect(contents.embed.filters).toEqual([
      { column: "platform", op: "eq", value: "youtube" },
    ]);
  });

  it("filters the aliased content relation without filtering representative content", async () => {
    const plan = await capturePlan((client) => client.from("memes")
      .select("meme_contents(content_id,is_representative),matched_contents:meme_contents!inner(platform)")
      .eq("matched_contents.platform", "YouTube"));
    attachDottedFilters(plan);
    const [contents, matching] = plan.fields;
    expect(contents?.kind).toBe("embed");
    expect(matching?.kind).toBe("embed");
    if (contents?.kind !== "embed" || matching?.kind !== "embed") return;
    expect(contents.embed.filters).toEqual([]);
    expect(matching.embed.filters).toEqual([{ column: "platform", op: "eq", value: "YouTube" }]);
    expect(matching.embed.inner).toBe(true);
  });
});
