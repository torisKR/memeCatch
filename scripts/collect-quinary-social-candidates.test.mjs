import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const scriptUrl = new URL("./collect-quinary-social-candidates.mjs", import.meta.url);
assert.ok(existsSync(scriptUrl), "quinary social collector must exist");

const source = readFileSync(scriptUrl, "utf8");
assert.match(source, /quinary_media_wiki|collection_path/);
assert.match(source, /firecrawl|MediaWiki|wikipedia/i);
assert.match(source, /oembed/i);
assert.doesNotMatch(source, /login_bypass|solve.?captcha|steal.?cookie|password\s*=/i);
assert.match(source, /Never logins|never login|Public oEmbed only/i);

console.log("collect-quinary-social-candidates safeguards OK");
// silence unused
void pathToFileURL;
