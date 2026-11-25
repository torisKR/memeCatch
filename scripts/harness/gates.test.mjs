import assert from "node:assert/strict";
import test from "node:test";
import { summarizeFailure } from "./failure.mjs";
import { gateNames, selectGates } from "./gates.mjs";

test("docs-only work needs the common diff gate only", () => {
  assert.deepEqual(selectGates(["docs/harness/agent-rules.md"]), []);
});

test("server source selects the Rust, behaviour, image and environment suites", () => {
  assert.deepEqual(selectGates(["server/src/routes/search.rs"]), [
    "install", "env", "rust", "behaviour", "server-image",
  ]);
});

test("UI and shared TS select generated assets and downstream consumers", () => {
  assert.deepEqual(selectGates(["server/assets/ui.css", "lib/mpe/media.ts"]), [
    "install", "ts", "env", "ui", "rust", "behaviour", "server-image", "worker-image",
  ]);
});

test("migrations and deployment checks use different suite selections", () => {
  assert.deepEqual(selectGates(["db/migrations/new.sql"]), [
    "install", "rust", "behaviour", "postgres",
  ]);
  assert.deepEqual(selectGates(["deploy/autodeploy/autodeploy.sh"]), ["env", "deploy"]);
});

test("CI workflow changes select every mirrored suite", () => {
  assert.deepEqual(selectGates([".github/workflows/ci.yml"]), gateNames);
});

test("harness changes use the dedicated node suite, and Node test changes add their tests", () => {
  assert.deepEqual(selectGates(["scripts/harness/run.mjs"]), ["harness", "env"]);
  assert.deepEqual(selectGates(["scripts/import-sheet-snapshot.test.mjs"]), [
    "install", "ts", "node", "env",
  ]);
});

test("explicit lists keep install prerequisites and reject unknown gates", () => {
  assert.deepEqual(selectGates([], "ts,deploy,ts"), ["install", "ts", "deploy"]);
  assert.throws(() => selectGates([], "ts,typo"), /Unknown gate: typo/);
  assert.throws(() => selectGates([], ""), /Unknown gate/);
});

test("summary keeps TAP, Rust and Vitest failing names and locations", () => {
  const output = [
    "\x1b[31mnot ok 1 - content renders\x1b[0m",
    "not ok 1 - content renders",
    "  AssertionError: expected green",
    "    at TestContext.<anonymous> (/work/tree/scripts/example.test.mjs:4:10)",
    "test routes::search::reject_bad_inputs ... FAILED",
    "error[E0308]: mismatched types",
    "  --> src/routes/search.rs:142:9",
    "FAIL  src/worker.test.ts > retries",
    "lib/mpe/media.ts(22,10): error TS2322: incompatible value",
    "test routes::search::renders ... ok",
  ].join("\n");
  const summary = summarizeFailure(output, { worktree: "/work/tree" });
  for (const expected of [
    "content renders", "reject_bad_inputs", "retries", "AssertionError", "error[E0308]",
    "scripts/example.test.mjs:4:10", "search.rs:142:9", "error TS2322",
  ]) {
    assert.ok(summary.some((line) => line.includes(expected)), expected);
  }
  assert.ok(summary.every((line) => !line.includes("/work/tree/") && !line.includes("\x1b")));
  assert.equal(summary.filter((line) => line.includes("content renders")).length, 1);
});

test("summary falls back to the end of the log and redacts known credential forms", () => {
  assert.deepEqual(summarizeFailure("progress\nlast line", { limit: 1 }), ["last line"]);
  assert.deepEqual(summarizeFailure("connect postgresql://user:password@127.0.0.1/db"), [
    "connect postgresql://[redacted]@127.0.0.1/db",
  ]);
  assert.deepEqual(summarizeFailure("x".repeat(500)).map((line) => line.length), [350]);
});
