import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260901010000_atomic_meme_origin_country.sql",
  ),
  "utf8",
);
const page = readFileSync(
  join(process.cwd(), "app/(default)/admin/memes/[id]/page.tsx"),
  "utf8",
);

describe("atomic meme origin country migration", () => {
  it("enforces one origin profile per meme", () => {
    expect(migration).toMatch(
      /create unique index if not exists meme_market_profiles_one_origin_idx[\s\S]*on public\.meme_market_profiles \(meme_id\)[\s\S]*where role = 'origin'/i,
    );
  });

  it("locks the meme and replaces the origin profile with its audit in one RPC", () => {
    const rpc = migration.slice(
      migration.indexOf("create or replace function public.set_meme_origin_country"),
      migration.indexOf("revoke all on function public.set_meme_origin_country"),
    );
    expect(rpc).toMatch(/security definer[\s\S]*set search_path = pg_catalog, public/i);
    expect(rpc).toContain("not public.is_operator()");
    expect(rpc).toContain("for update;");
    expect(rpc.indexOf("for update;")).toBeLessThan(
      rpc.indexOf("delete from public.meme_market_profiles"),
    );
    expect(rpc.indexOf("delete from public.meme_market_profiles")).toBeLessThan(
      rpc.indexOf("insert into public.meme_market_profiles"),
    );
    expect(rpc.indexOf("insert into public.meme_market_profiles")).toBeLessThan(
      rpc.indexOf("insert into public.admin_audit_log"),
    );
    expect(rpc).toContain("'reviewed'");
    expect(rpc).toContain("v_actor");
  });

  it("does not expose the definer RPC to anonymous callers", () => {
    expect(migration).toMatch(
      /revoke all on function public\.set_meme_origin_country\(uuid, text, text\)[\s\S]*from public, anon;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_meme_origin_country\(uuid, text, text\)[\s\S]*to authenticated;/i,
    );
  });
});

describe("admin meme origin country query", () => {
  it("fails closed when origin profiles cannot be loaded", () => {
    expect(page).toContain("error: originProfilesError");
    expect(page).toContain("if (originProfilesError)");
    expect(page).toContain('throw new Error("출처 국가 프로필을 불러오지 못했어요.")');
  });
});
