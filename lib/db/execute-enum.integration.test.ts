import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { executePlan, resetQueryMetadata } from "@/lib/db/execute";
import { getPool } from "@/lib/db/pool";

const databaseUrl = process.env.DATABASE_URL;
const anon = { userId: null, role: "anon" as const, anonymous: false };

describe.skipIf(!databaseUrl)("enum in() filters", () => {
  beforeAll(async () => {
    const pool = getPool();
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN NOINHERIT;
        END IF;
      END $$;
      CREATE SCHEMA IF NOT EXISTS extensions;
      GRANT USAGE ON SCHEMA public, extensions TO anon;
      DROP TABLE IF EXISTS public.memecatch_probe_enum;
      DROP TYPE IF EXISTS public.memecatch_probe_status;
      CREATE TYPE public.memecatch_probe_status AS ENUM ('pending', 'approved', 'rejected');
      CREATE TABLE public.memecatch_probe_enum (
        id integer PRIMARY KEY,
        moderation_status public.memecatch_probe_status NOT NULL
      );
      INSERT INTO public.memecatch_probe_enum (id, moderation_status)
      VALUES (1, 'approved'), (2, 'pending'), (3, 'rejected');
      GRANT SELECT ON public.memecatch_probe_enum TO anon;
      ALTER TABLE public.memecatch_probe_enum ENABLE ROW LEVEL SECURITY;
      CREATE POLICY memecatch_probe_enum_read
        ON public.memecatch_probe_enum
        FOR SELECT
        TO anon
        USING (true);
    `);
    resetQueryMetadata();
  });

  afterAll(async () => {
    const pool = getPool();
    await pool.query(`
      DROP TABLE IF EXISTS public.memecatch_probe_enum;
      DROP TYPE IF EXISTS public.memecatch_probe_status;
    `);
    resetQueryMetadata();
    await pool.end();
  });

  it("compares an enum column to a text array", async () => {
    const result = await executePlan(
      {
        op: "select",
        table: "memecatch_probe_enum",
        fields: [
          { kind: "column", name: "id" },
          { kind: "column", name: "moderation_status" },
        ],
        filters: [{ column: "moderation_status", op: "in", value: ["approved", "rejected"] }],
        orGroups: [],
        orders: [{ column: "id", ascending: true }],
        limit: null,
        offset: null,
        single: false,
        maybeSingle: false,
        count: null,
        head: false,
        returning: true,
      },
      anon,
    );
    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { id: 1, moderation_status: "approved" },
      { id: 3, moderation_status: "rejected" },
    ]);
  });
});
