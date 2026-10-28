import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert";

const __dirname = dirname(fileURLToPath(import.meta.url));
const jsonPath = resolve(__dirname, "../data/timeline-memes.json");
const sqlPath = resolve(__dirname, "../data/timeline-memes-insert.sql");

console.log("Running timeline memes dataset verification...");

assert.strictEqual(existsSync(jsonPath), true, "timeline JSON exists");
assert.strictEqual(existsSync(sqlPath), true, "timeline SQL exists");

const items = JSON.parse(readFileSync(jsonPath, "utf8"));
assert.strictEqual(items.length, 15, "15 timeline items");

// 연도 내림차순(최신순 -> 과거순) 검증
for (let i = 0; i < items.length - 1; i++) {
  assert.ok(
    items[i].origin_year >= items[i + 1].origin_year,
    `Items must be in descending order: ${items[i].title} (${items[i].origin_year}) >= ${items[i + 1].title} (${items[i + 1].origin_year})`
  );
}
console.log("✓ Descending order by year (2026 -> 2004) verified!");

const sql = readFileSync(sqlPath, "utf8");
for (const item of items) {
  assert.ok(sql.includes(item.slug), `SQL contains slug ${item.slug}`);
  assert.ok(sql.includes(item.title), `SQL contains title ${item.title}`);
}
console.log("✓ SQL transaction consistency verified!");
console.log("All timeline checks passed!");
