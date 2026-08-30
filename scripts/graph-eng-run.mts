#!/usr/bin/env node
/**
 * CatchMeme graph-engineering servo runner.
 *
 * Callers: this CLI (`node scripts/graph-eng-run.mts`); tests in
 * `scripts/graph-eng-run.test.ts`; cycle notes in
 * `artifacts/renewal/graph-eng/cycle-01.md`. No HTTP API. No new npm deps.
 *
 * State schema (synthetic): {
 *   "updatedAt": "2026-08-30T00:00:00.000Z",
 *   "nodes": {
 *     "plan": { "status": "pending", "verdict": null, "attempts": 0, "reason": "" }
 *   }
 * }
 * status: pending | running | judged (one-way). verdict: pass | fail | skip | null.
 *
 * User instruction: "Implement the smallest runner or checklist script that
 * records node state one-way (pending → running → judged). Prefer existing
 * files over new services. 0 new npm deps."
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const GRAPH_DOC = "docs/renewal/graph-engineering.md";
export const GRAPH_DOC_FALLBACK = "artifacts/renewal/graph-eng/graph-engineering.md";
export const DEFAULT_STATE_PATH = "artifacts/renewal/graph-eng/state.json";
export const MAX_FAIL_ATTEMPTS = 3;

export const NODE_IDS = ["plan", "design", "build", "judge", "deploy"] as const;
export type NodeId = (typeof NODE_IDS)[number];

export type NodeStatus = "pending" | "running" | "judged";
export type NodeVerdict = "pass" | "fail" | "skip" | null;

export type NodeState = {
  status: NodeStatus;
  verdict: NodeVerdict;
  attempts: number;
  reason: string;
};

export type GraphState = {
  updatedAt: string;
  nodes: Record<NodeId, NodeState>;
};

const EDGES: Record<NodeId, NodeId[]> = {
  plan: [],
  design: ["plan"],
  build: ["design"],
  judge: ["build"],
  deploy: ["judge"],
};

export function emptyNode(): NodeState {
  return { status: "pending", verdict: null, attempts: 0, reason: "" };
}

export function emptyGraph(): GraphState {
  return {
    updatedAt: "1970-01-01T00:00:00.000Z",
    nodes: {
      plan: emptyNode(),
      design: emptyNode(),
      build: emptyNode(),
      judge: emptyNode(),
      deploy: emptyNode(),
    },
  };
}

export function isNodeId(value: string): value is NodeId {
  return (NODE_IDS as readonly string[]).includes(value);
}

export function parseGraphState(raw: unknown): GraphState {
  const fallback = emptyGraph();
  if (!raw || typeof raw !== "object") return fallback;
  const rec = raw as { updatedAt?: unknown; nodes?: unknown };
  const nodes = { ...fallback.nodes };
  if (rec.nodes && typeof rec.nodes === "object") {
    for (const id of NODE_IDS) {
      const row = (rec.nodes as Record<string, unknown>)[id];
      if (!row || typeof row !== "object") continue;
      const n = row as Record<string, unknown>;
      const status: NodeStatus =
        n.status === "running" || n.status === "judged" ? n.status : "pending";
      const verdict: NodeVerdict =
        n.verdict === "pass" || n.verdict === "fail" || n.verdict === "skip"
          ? n.verdict
          : null;
      nodes[id] = {
        status,
        verdict,
        attempts: typeof n.attempts === "number" && n.attempts >= 0 ? n.attempts : 0,
        reason: typeof n.reason === "string" ? n.reason : "",
      };
    }
  }
  return {
    updatedAt:
      typeof rec.updatedAt === "string" && rec.updatedAt ? rec.updatedAt : fallback.updatedAt,
    nodes,
  };
}

function cloneState(state: GraphState): GraphState {
  return {
    updatedAt: state.updatedAt,
    nodes: {
      plan: { ...state.nodes.plan },
      design: { ...state.nodes.design },
      build: { ...state.nodes.build },
      judge: { ...state.nodes.judge },
      deploy: { ...state.nodes.deploy },
    },
  };
}

export function canStart(state: GraphState, id: NodeId): { ok: true } | { ok: false; error: string } {
  const node = state.nodes[id];
  if (node.status === "judged") {
    return { ok: false, error: `${id} is already judged; servo nodes do not rewind.` };
  }
  if (node.status === "running") {
    return { ok: false, error: `${id} is already running.` };
  }
  for (const parent of EDGES[id]) {
    const p = state.nodes[parent];
    if (p.status !== "judged") {
      return { ok: false, error: `${id} waits for ${parent} to be judged.` };
    }
  }
  if (id === "deploy" && state.nodes.judge.verdict !== "pass") {
    return { ok: false, error: "deploy starts only when judge verdict is pass." };
  }
  return { ok: true };
}

export function applyStart(
  state: GraphState,
  id: NodeId,
  now = new Date().toISOString(),
): GraphState {
  const gate = canStart(state, id);
  if (!gate.ok) throw new Error(gate.error);
  const next = cloneState(state);
  next.updatedAt = now;
  next.nodes[id] = { ...next.nodes[id], status: "running" };
  return next;
}

export function applyJudge(
  state: GraphState,
  id: NodeId,
  verdict: Exclude<NodeVerdict, null>,
  reason = "",
  now = new Date().toISOString(),
): GraphState {
  const node = state.nodes[id];
  if (node.status === "judged") {
    throw new Error(`${id} is already judged; servo nodes do not rewind.`);
  }
  if (node.status !== "running") {
    throw new Error(`${id} must be running before it can be judged.`);
  }
  const next = cloneState(state);
  next.updatedAt = now;
  if (verdict === "fail") {
    const attempts = node.attempts + 1;
    if (attempts >= MAX_FAIL_ATTEMPTS) {
      next.nodes[id] = {
        status: "judged",
        verdict: "skip",
        attempts,
        reason: reason || `skipped after ${MAX_FAIL_ATTEMPTS} failed attempts`,
      };
      return next;
    }
    next.nodes[id] = {
      status: "running",
      verdict: null,
      attempts,
      reason,
    };
    return next;
  }
  next.nodes[id] = {
    status: "judged",
    verdict,
    attempts: node.attempts,
    reason,
  };
  return next;
}

export function formatStatus(state: GraphState): string {
  const lines = NODE_IDS.map((id) => {
    const n = state.nodes[id];
    const verdict = n.verdict ?? "-";
    const reason = n.reason ? ` ${n.reason}` : "";
    return `${id}\t${n.status}\t${verdict}\tattempts=${n.attempts}${reason}`;
  });
  return [`updatedAt ${state.updatedAt}`, ...lines].join("\n");
}

export function loadState(path: string): GraphState {
  try {
    return parseGraphState(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return emptyGraph();
  }
}

export function saveState(path: string, state: GraphState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`);
}

function usage(): string {
  return [
    "Usage:",
    "  node scripts/graph-eng-run.mts status",
    "  node scripts/graph-eng-run.mts start <plan|design|build|judge|deploy>",
    "  node scripts/graph-eng-run.mts judge <node> pass|fail|skip [--reason …]",
    `State: ${DEFAULT_STATE_PATH}`,
  ].join("\n");
}

function parseReason(argv: string[]): string {
  const idx = argv.indexOf("--reason");
  if (idx === -1) return argv.filter((a) => a !== "--reason").slice(3).join(" ");
  return argv.slice(idx + 1).join(" ");
}

export function runCli(argv: string[], cwd = process.cwd()): { code: number; stdout: string } {
  const statePath = join(cwd, DEFAULT_STATE_PATH);
  const cmd = argv[0] ?? "status";
  if (cmd === "status" || cmd === "-h" || cmd === "--help") {
    if (cmd !== "status") return { code: 0, stdout: usage() };
    return { code: 0, stdout: formatStatus(loadState(statePath)) };
  }
  if (cmd === "start") {
    const id = argv[1] ?? "";
    if (!isNodeId(id)) return { code: 1, stdout: usage() };
    try {
      const next = applyStart(loadState(statePath), id);
      saveState(statePath, next);
      return { code: 0, stdout: formatStatus(next) };
    } catch (e) {
      return { code: 1, stdout: e instanceof Error ? e.message : String(e) };
    }
  }
  if (cmd === "judge") {
    const id = argv[1] ?? "";
    const verdict = argv[2] ?? "";
    if (!isNodeId(id) || (verdict !== "pass" && verdict !== "fail" && verdict !== "skip")) {
      return { code: 1, stdout: usage() };
    }
    try {
      const next = applyJudge(loadState(statePath), id, verdict, parseReason(argv));
      saveState(statePath, next);
      return { code: 0, stdout: formatStatus(next) };
    } catch (e) {
      return { code: 1, stdout: e instanceof Error ? e.message : String(e) };
    }
  }
  return { code: 1, stdout: usage() };
}

const isDirect =
  Boolean(process.argv[1]) &&
  (process.argv[1].endsWith("graph-eng-run.mts") || process.argv[1].endsWith("graph-eng-run.ts"));

if (isDirect) {
  const result = runCli(process.argv.slice(2));
  if (result.stdout) process.stdout.write(`${result.stdout}\n`);
  process.exit(result.code);
}
