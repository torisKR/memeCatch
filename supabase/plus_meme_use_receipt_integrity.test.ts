import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260810100000_plus_meme_use_receipt_integrity.sql"),
  "utf8",
);

describe("Plus meme use receipt integrity migration", () => {
  it("validates retry fields before returning idempotent success", () => {
    expect(migration).toMatch(/v_result_url text := nullif\(btrim\(p_result_url\), ''\)/i);
    expect(migration).toMatch(/v_performance_note text := nullif\(btrim\(p_performance_note\), ''\)/i);
    expect(migration).toMatch(/v_private_note text := nullif\(btrim\(p_private_note\), ''\)/i);
    expect(migration).toMatch(/if v_result_url is not null[\s\S]*char_length\(v_result_url\)[\s\S]*v_result_url !~/i);
    expect(migration).toMatch(/char_length\(v_performance_note\) > 1000/i);
    expect(migration).toMatch(/char_length\(v_private_note\) > 1000/i);
    expect(migration).toMatch(/p_locale is null[\s\S]*invalid_locale[\s\S]*p_channel is null[\s\S]*invalid_channel/i);
    const existingReceiptStart = migration.indexOf("  if found then");
    const existingReceiptEnd = migration.indexOf("\n  end if;", existingReceiptStart);
    const existingReceiptBranch = migration.slice(existingReceiptStart, existingReceiptEnd);
    const conflictFields = [
      "channel",
      "locale",
      "artifact_kind",
      "result_url",
      "performance_note",
      "private_note",
    ];
    for (const field of conflictFields) {
      expect(existingReceiptBranch).toContain(
        field === "result_url" || field === "performance_note" || field === "private_note"
          ? `v_receipt.${field} is distinct from v_${field}`
          : `v_receipt.${field} is distinct from p_${field}`,
      );
    }
    expect(existingReceiptBranch).toContain("message = 'receipt_conflict'");
  });

  it("keeps the race-safe insert branch fail-closed and does not update receipts", () => {
    expect(migration).toMatch(/on conflict \(user_id, meme_id, completion_date\) do nothing[\s\S]*returning \* into v_receipt/i);
    const raceBranch = migration.slice(migration.lastIndexOf("  if not found then"));
    for (const field of [
      ["channel", "p_channel"],
      ["locale", "p_locale"],
      ["artifact_kind", "p_artifact_kind"],
      ["result_url", "v_result_url"],
      ["performance_note", "v_performance_note"],
      ["private_note", "v_private_note"],
    ]) {
      expect(raceBranch).toContain(`v_receipt.${field[0]} is distinct from ${field[1]}`);
    }
    expect(raceBranch).toContain("into strict v_receipt");
    expect(raceBranch).toContain("message = 'receipt_conflict'");
    expect(migration).not.toMatch(/update public\.plus_meme_use_receipts/i);
  });
});
