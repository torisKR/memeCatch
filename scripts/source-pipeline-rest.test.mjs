import assert from "node:assert/strict";
import { buildRestQuery, parseFilterValue } from "./source-pipeline-rest.mjs";

function recorder() {
  const calls = [];
  const chain = new Proxy({}, {
    get: (_, name) => (...args) => { calls.push([name, ...args]); return chain; },
  });
  return { db: { from: (table) => { calls.push(["from", table]); return chain; } }, calls };
}

assert.deepEqual(parseFilterValue("eq.abc"), ["eq", "abc", false]);
assert.deepEqual(parseFilterValue("not.is.null"), ["is", null, true]);
assert.deepEqual(parseFilterValue("in.(approved,limited)"), ["in", ["approved", "limited"], false]);
assert.throws(() => parseFilterValue("garbage"), /unsupported/);

let r = recorder();
buildRestQuery(r.db, "memes?select=id,title&moderation_status=in.(approved,limited)&order=trend_score.desc&offset=10&limit=5");
assert.deepEqual(r.calls, [
  ["from", "memes"],
  ["select", "id,title"],
  ["filter", "moderation_status", "in", ["approved", "limited"]],
  ["order", "trend_score", { ascending: false }],
  ["range", 10, 14],
]);

r = recorder();
buildRestQuery(r.db, "media_sources?on_conflict=canonical_url", {
  method: "POST",
  headers: { Prefer: "return=representation,resolution=merge-duplicates" },
  body: JSON.stringify([{ canonical_url: "u" }]),
});
assert.deepEqual(r.calls, [
  ["from", "media_sources"],
  ["upsert", [{ canonical_url: "u" }], { onConflict: "canonical_url", ignoreDuplicates: false }],
  ["select", "*"],
]);

r = recorder();
buildRestQuery(r.db, "meme_media", {
  method: "POST",
  headers: { Prefer: "resolution=ignore-duplicates" },
  body: JSON.stringify({ meme_id: "m" }),
});
assert.deepEqual(r.calls[1], ["upsert", { meme_id: "m" }, { onConflict: undefined, ignoreDuplicates: true }]);

r = recorder();
buildRestQuery(r.db, "meme_contents?id=eq.7", { method: "PATCH", body: JSON.stringify({ a: 1 }) });
assert.deepEqual(r.calls, [["from", "meme_contents"], ["update", { a: 1 }], ["filter", "id", "eq", "7"]]);

r = recorder();
buildRestQuery(r.db, "meme_sources?select=id&or=(source_url.ilike.*youtube.com*,source_url.ilike.*youtu.be*)");
assert.deepEqual(r.calls[2], ["or", "source_url.ilike.*youtube.com*,source_url.ilike.*youtu.be*"]);

r = recorder();
buildRestQuery(r.db, "media_sources?select=id&order=last_checked_at.asc.nullsfirst");
assert.deepEqual(r.calls[2], ["order", "last_checked_at", { ascending: true, nullsFirst: true }]);

console.log("source-pipeline-rest OK");
