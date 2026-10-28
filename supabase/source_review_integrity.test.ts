import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261014120000_atomic_source_review.sql",
  "utf8",
);
const repairMigration = readFileSync(
  "supabase/migrations/20261014123000_atomic_source_review_projection_repair.sql",
  "utf8",
);
const sqlTest = readFileSync("supabase/tests/source_review_integrity.sql", "utf8");

describe("atomic source review database contract", () => {
  it("keeps review, projections and audit in one authorized transaction", () => {
    expect(migration).toMatch(/create or replace function public\.review_meme_source_atomic/i);
    expect(migration).toMatch(/security definer[\s\S]*set search_path = pg_catalog, public/i);
    expect(migration).toMatch(/auth\.uid\(\)[\s\S]*public\.is_operator\(\) is distinct from true/i);
    expect(migration).toMatch(/from public\.memes[\s\S]*for update/i);
    expect(migration).toMatch(/from public\.meme_media[\s\S]*for update/i);
    expect(migration).toMatch(/from public\.media_sources[\s\S]*for update/i);
    expect(migration).toMatch(/update public\.meme_media[\s\S]*insert into public\.meme_sources[\s\S]*insert into public\.meme_contents[\s\S]*insert into public\.admin_audit_log/i);
    expect(migration).not.toMatch(/exception\s+when\s+others/i);
  });

  it("publishes only fresh, public and policy-compatible metadata", () => {
    expect(migration).toMatch(/public_status is distinct from 'public'/i);
    expect(migration).toMatch(/removed_at is not null/i);
    expect(migration).toMatch(/metadata_expires_at <= now\(\)/i);
    expect(migration).toMatch(/embeddable is distinct from true/i);
    expect(migration).toMatch(/p_rights_basis not in[\s\S]*'link_only'/i);
    expect(migration).toMatch(/p_source_role = 'original' and p_rights_basis = 'link_only'/i);
    expect(migration).toMatch(/p_decision is null or p_decision not in/i);
    expect(migration).toMatch(/p_source_role is null or p_source_role not in/i);
    expect(migration).toMatch(/p_rights_basis is null or p_rights_basis not in/i);
    expect(migration).toMatch(/media_source_identity_mismatch/i);
    expect(migration).toMatch(/metadata_refreshed_at < now\(\) - interval '30 days'/i);
    expect(migration).toMatch(/last_checked_at < now\(\) - interval '30 days'/i);
    expect(migration).toMatch(/last_checked_at > now\(\) \+ interval '5 minutes'/i);
    expect(migration).toMatch(/metadata_expires_at > v_source\.metadata_refreshed_at \+ interval '30 days 5 minutes'/i);
  });

  it("requires an approved child and approved public parent for anonymous reads", () => {
    expect(migration).toMatch(/create policy contents_public_read[\s\S]*moderation_status = 'approved'::public\.submission_status[\s\S]*meme\.moderation_status in \('approved', 'limited'\)/i);
    expect(sqlTest).toContain("pending child is not public");
    expect(sqlTest).toContain("rejected child is not public");
  });

  it("ships executable rollback coverage for projection and audit failures", () => {
    expect(sqlTest).toContain("projection failure rolls ledger back");
    expect(sqlTest).toContain("audit failure rolls ledger back");
    expect(sqlTest).toContain("non-operator cannot review a source");
    expect(sqlTest).toContain("identical approval retry is idempotent");
    expect(sqlTest).toContain("private source is blocked");
    expect(sqlTest).toContain("stale metadata is blocked");
    expect(sqlTest).toContain("null decision is blocked");
    expect(sqlTest).toContain("canonical external ID mismatch is blocked");
    expect(sqlTest).toContain("canonical platform mismatch is blocked for link-only");
    expect(sqlTest).toContain("metadata older than 30 days is blocked despite future expiry");
    expect(sqlTest).toContain("four-second runtime expiry skew is accepted");
    expect(sqlTest).toContain("last checked older than 30 days is blocked");
    expect(sqlTest.trimEnd()).toMatch(/rollback;$/i);
  });

  it("repairs only missing projections for an otherwise identical approved review", () => {
    expect(repairMigration).toMatch(/create function public\.review_meme_source_atomic/i);
    expect(repairMigration).toContain("source.repair_projection");
    expect(repairMigration).toContain("source_projection_conflict");
    expect(repairMigration).toContain("content_projection_conflict");
    expect(sqlTest).toContain("identical approved review repairs missing projections");
    expect(sqlTest).toContain("complete repaired projection is truly idempotent");
    expect(sqlTest).toContain("conflicting public source is not overwritten");
    expect(sqlTest).toContain("conflicting public content is not overwritten");
  });
});
