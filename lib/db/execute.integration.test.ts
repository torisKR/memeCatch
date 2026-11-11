import { afterAll, describe, expect, it } from "vitest";
import { executePlan } from "@/lib/db/execute";
import { createPlanClient } from "@/lib/db/plan";
import { getPool } from "@/lib/db/pool";

const databaseUrl = process.env.DATABASE_URL;
const anon = { userId: null, role: "anon" as const, anonymous: false };
const service = { userId: null, role: "service_role" as const, anonymous: false };

describe.skipIf(!databaseUrl)("postgres query executor", () => {
  afterAll(async () => {
    await getPool().end();
  });

  it("reads public memes as anon and embeds contents", async () => {
    const result = await executePlan(
      {
        op: "select",
        table: "memes",
        fields: [
          { kind: "column", name: "id" },
          { kind: "column", name: "short_id" },
          { kind: "embed", embed: { alias: "meme_contents", table: "meme_contents", inner: false, hint: null, fields: [{ kind: "column", name: "url" }], filters: [], orGroups: [], orders: [], limit: 5 } },
        ],
        filters: [{ column: "moderation_status", op: "eq", value: "approved" }],
        orGroups: [],
        orders: [{ column: "short_id", ascending: true }],
        limit: 5,
        offset: null,
        single: false,
        maybeSingle: false,
        count: "exact",
        head: false,
        returning: true,
      },
      anon,
    );
    expect(result.error).toBeNull();
    expect(result.count).toBeGreaterThan(0);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("rejects a table outside the public catalog", async () => {
    const client = createPlanClient((plan, signal) => executePlan(plan, anon, signal));
    const result = await client.from("pg_authid").select("rolname");
    expect(result.error?.code).toBe("42602");
  });

  it("does not let anon pretend to be service_role", async () => {
    const inserted = await executePlan(
      {
        op: "insert",
        table: "profiles",
        fields: [{ kind: "star" }],
        filters: [],
        orGroups: [],
        orders: [],
        limit: null,
        offset: null,
        single: true,
        maybeSingle: false,
        count: null,
        head: false,
        returning: true,
        values: { id: "00000000-0000-4000-8000-000000000099", nickname: "anon-nope" },
      },
      anon,
    );
    expect(inserted.error).not.toBeNull();
    const operator = await executePlan(
      {
        op: "rpc",
        fn: "is_operator",
        fields: [{ kind: "star" }],
        filters: [],
        orGroups: [],
        orders: [],
        limit: null,
        offset: null,
        single: false,
        maybeSingle: false,
        count: null,
        head: false,
        returning: true,
        args: {},
      },
      service,
    );
    expect(operator.error).toBeNull();
    expect(operator.data).toBe(false);
  });

  it("drops the cancel listener when the transaction ends", async () => {
    const controller = new AbortController();
    const plan = {
      op: "select" as const,
      table: "memes",
      fields: [{ kind: "column" as const, name: "id" }],
      filters: [],
      orGroups: [],
      orders: [],
      limit: 1,
      offset: null,
      single: false,
      maybeSingle: false,
      count: null,
      head: false,
      returning: true,
    };
    const first = await executePlan(plan, anon, controller.signal);
    expect(first.error).toBeNull();
    controller.abort();
    const second = await executePlan(plan, anon);
    expect(second.error).toBeNull();
  });
});
