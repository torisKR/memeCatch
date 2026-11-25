import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import { text } from "node:stream/consumers";

const prompt = await text(process.stdin);
assert.match(prompt, /Implement the colour contract/);
assert.match(prompt, /MemeCatch 하네스 에이전트 규칙/);
assert.equal(process.env.DATABASE_URL, undefined);
assert.equal(process.env.OPENAI_API_KEY, undefined);
if (process.argv.includes("--blocked")) {
  console.log("BLOCKED: clarify the acceptance criterion");
  process.exit(0);
}

const testPath = "colour.test.mjs";
const retry = existsSync(testPath);
assert.equal(retry, prompt.includes("Gate node failed."));
if (retry) assert.match(prompt, /colour is green/);

writeFileSync(testPath, `import assert from "node:assert/strict";
import test from "node:test";
test("colour is green", () => assert.equal("${retry ? "green" : "red"}", "green"));
`);
