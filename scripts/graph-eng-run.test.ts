/**
 * Callers: vitest via `pnpm exec vitest run scripts/graph-eng-run.test.ts`.
 * Imports `scripts/graph-eng-run.mts` only. No production API. Synthetic state:
 * `{ "updatedAt": "2026-08-30T00:00:00.000Z", "nodes": { "plan": { "status": "pending", "verdict": null, "attempts": 0, "reason": "" } } }`.
 * User instruction: "Implement the smallest runner or checklist script that
 * records node state one-way (pending → running → judged)." and
 * "Do not delete/weaken tests". Tick 12 close-out: lock cycle-01..cycle-12
 * files on disk (heading completeness alone would pass if a tick file were deleted).
 */
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyJudge,
  applyStart,
  canStart,
  cycleChangeListGaps,
  DEFAULT_STATE_PATH,
  emptyGraph,
  MAX_FAIL_ATTEMPTS,
  NODE_IDS,
  runCli,
} from "./graph-eng-run.mts";

const dirs: string[] = [];

afterEach(() => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("graph-eng-run one-way state", () => {
  it("starts plan from pending and refuses rewind after judged", () => {
    const now = "2026-08-30T13:00:00.000Z";
    let state = emptyGraph();
    expect(canStart(state, "design").ok).toBe(false);
    state = applyStart(state, "plan", now);
    expect(state.nodes.plan.status).toBe("running");
    state = applyJudge(state, "plan", "pass", "dag locked", now);
    expect(state.nodes.plan).toMatchObject({ status: "judged", verdict: "pass" });
    expect(() => applyStart(state, "plan", now)).toThrow(/do not rewind/);
    expect(() => applyJudge(state, "plan", "skip", "", now)).toThrow(/do not rewind/);
  });

  it("skips a node after three failed judge attempts without spinning", () => {
    const now = "2026-08-30T13:01:00.000Z";
    let state = applyStart(emptyGraph(), "plan", now);
    state = applyJudge(state, "plan", "fail", "attempt 1", now);
    expect(state.nodes.plan.status).toBe("running");
    expect(state.nodes.plan.attempts).toBe(1);
    state = applyJudge(state, "plan", "fail", "attempt 2", now);
    state = applyJudge(state, "plan", "fail", "attempt 3", now);
    expect(state.nodes.plan.status).toBe("judged");
    expect(state.nodes.plan.verdict).toBe("skip");
    expect(state.nodes.plan.attempts).toBe(MAX_FAIL_ATTEMPTS);
    expect(canStart(state, "plan").ok).toBe(false);
  });

  it("blocks deploy unless judge passed, and persists CLI state", () => {
    const cwd = mkdtempSync(join(tmpdir(), "graph-eng-"));
    dirs.push(cwd);
    expect(runCli(["start", "plan"], cwd).code).toBe(0);
    expect(runCli(["judge", "plan", "pass"], cwd).code).toBe(0);
    expect(runCli(["start", "design"], cwd).code).toBe(0);
    expect(runCli(["judge", "design", "pass"], cwd).code).toBe(0);
    expect(runCli(["start", "build"], cwd).code).toBe(0);
    expect(runCli(["judge", "build", "pass"], cwd).code).toBe(0);
    expect(runCli(["start", "judge"], cwd).code).toBe(0);
    expect(runCli(["judge", "judge", "skip", "--reason", "tsc blocked"], cwd).code).toBe(0);
    const blocked = runCli(["start", "deploy"], cwd);
    expect(blocked.code).toBe(1);
    expect(blocked.stdout).toContain("judge verdict is pass");
    const saved = JSON.parse(
      readFileSync(join(cwd, "artifacts/renewal/graph-eng/state.json"), "utf8"),
    );
    expect(saved.nodes.judge.verdict).toBe("skip");
    expect(saved.nodes.judge.status).toBe("judged");
  });

  it("forbids skipping running: pending cannot be judged; running cannot restart", () => {
    const now = "2026-08-31T02:00:00.000Z";
    expect(() => applyJudge(emptyGraph(), "plan", "pass", "", now)).toThrow(
      /must be running/,
    );
    const running = applyStart(emptyGraph(), "plan", now);
    expect(running.nodes.plan.status).toBe("running");
    expect(() => applyStart(running, "plan", now)).toThrow(/already running/);
    expect(canStart(running, "plan").ok).toBe(false);
  });

  it("CLI refuses rewind of a judged DAG and leaves state.json unchanged", () => {
    const cwd = mkdtempSync(join(tmpdir(), "graph-eng-"));
    dirs.push(cwd);
    const judged = {
      updatedAt: "2026-08-31T00:00:00.000Z",
      nodes: Object.fromEntries(
        NODE_IDS.map((id) => [
          id,
          { status: "judged", verdict: "pass", attempts: 0, reason: "locked" },
        ]),
      ),
    };
    const statePath = join(cwd, DEFAULT_STATE_PATH);
    mkdirSync(join(cwd, "artifacts/renewal/graph-eng"), { recursive: true });
    writeFileSync(statePath, `${JSON.stringify(judged, null, 2)}\n`);
    const before = readFileSync(statePath, "utf8");
    const start = runCli(["start", "plan"], cwd);
    expect(start.code).toBe(1);
    expect(start.stdout).toMatch(/do not rewind/);
    const judge = runCli(["judge", "deploy", "pass"], cwd);
    expect(judge.code).toBe(1);
    expect(judge.stdout).toMatch(/do not rewind/);
    expect(readFileSync(statePath, "utf8")).toBe(before);
  });

  it("keeps cycle-01 through cycle-12 change-lists on disk", () => {
    const dir = join(process.cwd(), "artifacts/renewal/graph-eng");
    for (let n = 1; n <= 12; n += 1) {
      const name = `cycle-${String(n).padStart(2, "0")}.md`;
      expect(existsSync(join(dir, name)), name).toBe(true);
    }
  });

  it("every cycle change-list has required headings", () => {
    const dir = join(process.cwd(), "artifacts/renewal/graph-eng");
    const files = readdirSync(dir).filter((name) => /^cycle-\d+\.md$/.test(name));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      expect(cycleChangeListGaps(readFileSync(join(dir, name), "utf8")), name).toEqual(
        [],
      );
    }
    expect(cycleChangeListGaps("# incomplete")).toEqual([
      "## Nodes",
      "## Change-list",
      "## Judge evidence",
      "## Locked rules honored",
      "## Next node for tick",
    ]);
  });
});
