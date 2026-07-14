import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./collect-wikimedia-viral-video-candidates.mjs", import.meta.url),
  "utf8"
);

assert.match(source, /Wikimedia Category: Viral videos/);
assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /year < 2000 \|\| year > 2020/);
assert.doesNotMatch(source, /meme_contents|meme_sources|supabase/i);
console.log("collect-wikimedia-viral-video-candidates safeguards OK");
