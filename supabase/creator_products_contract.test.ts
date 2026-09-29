import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationName = "20260927184114_creator_products.sql";
const migrationPath = join(process.cwd(), "supabase/migrations", migrationName);

describe("creator products migration contract", () => {
  it("defines isolated listings, owner/admin access, and database-guarded moderation", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/create table public\.creator_products/i);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/is_operator\(\)/i);
    expect(sql).toMatch(/moderation_status.*pending/i);
    expect(sql).toMatch(/creator-products/i);
    expect(sql).toMatch(/grant select[\s\S]*?to anon/i);
    expect(sql).toMatch(/creator_product_(submit|update|moderate)/i);
    expect(sql).toMatch(/where id\s*=\s*p_id and owner_id\s*=\s*auth\.uid\(\)/i);
    expect(sql).toMatch(/if not public\.is_operator\(\) then raise exception 'operator_required'/i);
    expect(sql).toMatch(/moderation_status='pending'/i);
    expect(sql).toMatch(/moderation_status = 'approved'/i);
    expect(sql).toMatch(/moderation_status='pending'[\s\S]*?reviewed_by=null/);
    expect(sql).toMatch(/creator_product_url_is_safe\(external_url\)/i);
    expect(sql).toMatch(/creator_product_upload/);
    expect(sql).toMatch(/create table public\.creator_product_rate_limits/i);
    expect(sql).toMatch(/create or replace function public\.reserve_creator_product_upload\(\)/i);
    expect(sql).toMatch(/grant execute on function public\.reserve_creator_product_upload\(\) to authenticated/i);
    expect(sql).not.toMatch(/create or replace function public\.reserve_api_request/i);
    expect(sql).not.toMatch(/public\.api_rate_limits/);
    expect(sql).toMatch(/create or replace function public\.creator_product_submit[\s\S]*?values \(auth\.uid\(\),'submission',v_window_start,1\)[\s\S]*?if v_count > 5[\s\S]*?insert into public\.creator_products/i);
    expect(sql).toMatch(/on public\.creator_products to anon/i);
    expect(sql).not.toMatch(/grant select on public\.creator_products to anon/i);
    expect(sql).toMatch(/creator_products_public_approved_read[\s\S]*?using \(moderation_status = 'approved'\)/i);
    expect(sql).toMatch(/grant select \(id,title,description,external_url,image_path,price,category,relationship_disclosure,moderation_status,created_at\)[\s\S]*?to anon/i);
    expect(sql).not.toMatch(/alter table public\.affiliate_products/i);
  });

  it("does not expose operator moderation to the public database role", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/revoke all on function public\.creator_product_moderate\(uuid,text,text\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.creator_product_moderate\(uuid,text,text\) to authenticated/i);
  });

  it("is additive and has a unique migration filename", () => {
    const names = readdirSync(join(process.cwd(), "supabase/migrations"));
    expect(names.filter((name) => name === migrationName)).toHaveLength(1);
  });
});
