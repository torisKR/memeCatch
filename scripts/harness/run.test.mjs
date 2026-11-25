import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("./run.mjs", import.meta.url));
const stub = fileURLToPath(new URL("./fixtures/stub-agent.mjs", import.meta.url));

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "memecatch-harness-e2e-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, "repo");
  const output = join(dir, "with space", "runs");
  const spec = join(dir, "task.md");
  mkdirSync(repo);
  writeFileSync(join(repo, "README.md"), "fixture\n");
  writeFileSync(spec, "# Implement the colour contract\n");
  const git = (...args) => execFileSync("git", [
    "-c", "core.hooksPath=/dev/null", "-c", "user.name=Fixture",
    "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args,
  ], { cwd: repo, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main");
  git("remote", "add", "origin", "file:///nonexistent/harness-remote");
  git("add", "README.md");
  git("commit", "-qm", "test: fixture baseline");
  const base = git("rev-parse", "HEAD");
  git("update-ref", "refs/remotes/origin/main", base);
  writeFileSync(join(repo, "README.md"), "caller worktree stays dirty\n");
  return {
    base, git, repo,
    run: (budget, ...agentArgs) => {
      const result = spawnSync(process.execPath, [
        runner, "--task", spec, "--agent", process.execPath, `--agent-arg=${stub}`,
        ...agentArgs.map((arg) => `--agent-arg=${arg}`),
        "--gates", "node", "--max-iterations", String(budget), "--worktree-dir", output,
      ], {
        cwd: repo, encoding: "utf8", timeout: 25_000,
        env: { ...process.env, DATABASE_URL: "fixture-never-forward",
          OPENAI_API_KEY: "fixture-never-forward" },
      });
      assert.ifError(result.error);
      const dir = join(output, readdirSync(output)[0]);
      const report = JSON.parse(readFileSync(join(dir, "report.json"), "utf8"));
      const markdown = readFileSync(join(dir, "report.md"), "utf8");
      return { dir, report, markdown, result };
    },
  };
}

test("offline stub goes red to green in two iterations in a fresh worktree", (t) => {
  const f = fixture(t);
  const { dir, report, markdown, result } = f.run(2);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(report.base, f.base);
  assert.match(report.branch, /^harness\/run-/);
  assert.equal(report.verdict, "green");
  assert.deepEqual(report.changedFiles, ["colour.test.mjs"]);
  assert.deepEqual(report.iterations.map(({ status }) => status), ["failed", "green"]);
  const [red, green] = report.iterations.map(({ gates }) => gates.find(({ name }) => name === "node"));
  assert.equal(red.status, "failed");
  assert.equal(green.status, "passed");
  assert.match(red.summary.join("\n"), /colour is green/);
  assert.match(readFileSync(join(dir, red.steps[0].log), "utf8"), /not ok/);
  assert.ok(report.iterations[1].omittedGates.includes("ts"));
  assert.match(markdown, /Verdict: \*\*green\*\*/);
  assert.equal(f.git("branch", "--show-current"), "main");
  assert.equal(f.git("status", "--porcelain"), "M README.md");
});

test("budget exhaustion preserves red evidence and exits nonzero", (t) => {
  const { report, result } = fixture(t).run(1);
  assert.equal(result.status, 1);
  assert.equal(report.verdict, "budget_exhausted");
  assert.equal(report.iterations.length, 1);
  assert.equal(report.iterations[0].gates.find(({ name }) => name === "node").status, "failed");
});

test("a decision request stops the loop early and records the blocker", (t) => {
  const { report, result } = fixture(t).run(4, "--blocked");
  assert.equal(result.status, 1);
  assert.equal(report.verdict, "blocked");
  assert.match(report.blocker, /clarify the acceptance criterion/);
  assert.equal(report.iterations.length, 1);
  assert.deepEqual(report.iterations[0].gates, []);
});
