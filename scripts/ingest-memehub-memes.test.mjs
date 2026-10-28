import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(__dirname, "../data/memehub-memes.json");
const sqlPath = resolve(__dirname, "../data/memehub-memes.sql");

console.log("Running memehub content verification test...");

assert.strictEqual(existsSync(dataPath), true, "data/memehub-memes.json exists");
const raw = readFileSync(dataPath, "utf8");
const items = JSON.parse(raw);

assert.strictEqual(Array.isArray(items), true, "items is an array");
assert.strictEqual(items.length, 12, "contains exactly 12 items");

const validCategories = new Set(["phrase", "dance", "song", "image", "comment", "challenge"]);
const validSafety = new Set(["green", "yellow", "gray", "red"]);

for (const item of items) {
  assert.ok(item.title, `item has title: ${item.title}`);
  assert.match(item.slug, /^[a-z0-9-]+$/, `valid slug: ${item.slug}`);
  assert.strictEqual(item.origin_kind, "house_original", "origin_kind is house_original");
  assert.strictEqual(validCategories.has(item.category), true, `valid category: ${item.category}`);
  assert.strictEqual(validSafety.has(item.safety_level), true, `valid safety: ${item.safety_level}`);
  assert.strictEqual(item.origin_year, 2026, "origin_year is 2026");
  assert.ok(item.sources.length >= 1, "has at least 1 source");

  for (const src of item.sources) {
    assert.match(src.url, /^https:\/\/www\.youtube\.com\//, "source url is youtube");
    assert.ok(["original", "secondary_reference"].includes(src.source_role), "source_role is valid");
    assert.strictEqual(src.rights_basis, "creator_permission", "rights_basis is creator_permission");
  }

  assert.ok(item.claims.length >= 1, "claims >= 1");
  assert.ok(item.tags.length >= 3, "tags >= 3");
}
console.log("✓ JSON schema and data contract valid!");

assert.strictEqual(existsSync(sqlPath), true, "data/memehub-memes.sql exists");
const sql = readFileSync(sqlPath, "utf8");
assert.ok(sql.includes("BEGIN;"), "sql has BEGIN;");
assert.ok(sql.trim().endsWith("COMMIT;"), "sql ends with COMMIT;");

for (const item of items) {
  assert.ok(sql.includes(item.slug), `sql contains slug ${item.slug}`);
  assert.ok(sql.includes(item.title), `sql contains title ${item.title}`);
}
console.log("✓ SQL transaction and record consistency valid!");
console.log("All 12 items verified successfully!");
