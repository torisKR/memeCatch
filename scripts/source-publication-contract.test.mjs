import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const daily = readFileSync(new URL("./daily-source-discovery.sh", import.meta.url), "utf8");
assert.doesNotMatch(daily, /auto-approve-source-candidates/);
assert.match(daily, /discover-youtube-candidates/);
assert.match(daily, /verify-youtube-pending/);

const direct = spawnSync(process.execPath, [new URL("./auto-approve-source-candidates.mjs", import.meta.url).pathname], {
  encoding: "utf8",
  env: { PATH: process.env.PATH },
});
assert.equal(direct.status, 2);
assert.match(direct.stderr, /--operator-confirm-auto-approve/);

console.log("source publication requires human/operator review OK");
