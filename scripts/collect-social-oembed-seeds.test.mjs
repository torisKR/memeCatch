import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";

const scriptUrl = new URL("./collect-social-oembed-seeds.mjs", import.meta.url);
assert.ok(existsSync(scriptUrl), "social oEmbed seed collector CLI must exist");

const source = readFileSync(scriptUrl, "utf8");
assert.match(source, /verifySocialSeedOEmbed/);
assert.match(source, /TikTok.*Instagram|Instagram.*TikTok/);
assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /Does not log in|does not log in/i);
assert.doesNotMatch(source, /Display API|challenge bypass|video download/i);

console.log("collect-social-oembed-seeds safeguards OK");
