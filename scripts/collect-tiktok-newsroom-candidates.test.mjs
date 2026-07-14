import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptUrl = new URL("./collect-tiktok-newsroom-candidates.mjs", import.meta.url);
assert.ok(existsSync(scriptUrl), "TikTok Newsroom collector CLI must exist");

const source = readFileSync(scriptUrl, "utf8");
assert.match(source, /collectTikTokNewsroomCandidates/);
assert.match(source, /needs_human_source_match|review-only/i);
assert.doesNotMatch(source, /TIKTOK_CLIENT_(?:KEY|SECRET)/);
assert.doesNotMatch(source, /video\.download|download.*video/i);

const result = spawnSync(process.execPath, [fileURLToPath(scriptUrl)], { encoding: "utf8" });
assert.equal(result.status, 2);
assert.match(result.stderr, /usage:/i);

console.log("TikTok Newsroom collector CLI safeguards OK");
