import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ciScript = fileURLToPath(new URL("./ci.sh", import.meta.url));
const nodeTests = [
  "scripts/import-sheet-snapshot.test.mjs",
  "scripts/prepare-sheet-source-candidates.test.mjs",
  "scripts/youtube-response.test.mjs",
  "scripts/source-publication-contract.test.mjs",
];

const gateRules = {
  install: /^$/,
  ts: /^(?!scripts\/harness\/)(?:(?:scripts|lib|integrations)\/|.*\.[cm]?[jt]sx?$|.*(?:package\.json|tsconfig.*\.json|pnpm-.*\.ya?ml))|^server\/ui\//,
  node: /^(?!scripts\/harness\/).*\.test\.mjs$/,
  harness: /^scripts\/harness\//,
  env: /^(?:scripts|server|lib|integrations|deploy|\.github\/workflows)\/|^(?:Dockerfile|docker-compose)/,
  ui: /^(?:server\/(?:ui|assets|static|scripts)\/|lib\/|public\/)|^(?:pnpm-|package\.json|tsconfig\.json)/,
  rust: /^(?:server\/(?:src|tests|scripts|assets|i18n|static)\/|server\/(?:Cargo\.|rust-toolchain)|db\/migrations\/|deploy\/postgres\/|integrations\/memecatch-chatgpt\/ui\/|public\/)/,
  behaviour: /^(?:server\/|public\/|lib\/|db\/migrations\/|deploy\/postgres\/|integrations\/memecatch-chatgpt\/ui\/)|^(?:pnpm-|package\.json)/,
  deploy: /^(?:deploy|\.github\/workflows)\/|^(?:scripts\/deploy-oci|docker-compose|Dockerfile)/,
  "server-image": /^(?:Dockerfile\.server|\.dockerignore)$|^(?:server\/|public\/|deploy\/build\.env|integrations\/memecatch-chatgpt\/ui\/)/,
  "worker-image": /^(?:Dockerfile\.mpe-worker|\.dockerignore|package\.json|pnpm-)|^(?:lib\/|scripts\/(?:mpe-|worker-import-smoke|register-ts-paths|ts-path-hooks))/,
  "backup-image": /^(?:\.dockerignore$|deploy\/backup\/)/,
  postgres: /^(?:db\/migrations\/|scripts\/postgres\/|deploy\/postgres\/)/,
};

export const gateNames = Object.keys(gateRules);
const requiresInstall = new Set(["ts", "ui", "behaviour"]);

export function selectGates(files, requested = "auto") {
  const selected = requested === "auto"
    ? gateNames.filter((gate) => gate !== "install" && files.some((file) =>
      file === ".github/workflows/ci.yml" || gateRules[gate].test(file)))
    : [...new Set(requested.split(","))];
  for (const gate of selected) {
    if (!Object.hasOwn(gateRules, gate)) throw new Error(`Unknown gate: ${gate}`);
  }
  if (selected.some((gate) => requiresInstall.has(gate))) selected.push("install");
  return gateNames.filter((gate) => selected.includes(gate));
}

export function gateSteps(gate, { cwd, files, release }) {
  const node = process.execPath;
  // Keep failure names in TAP's "not ok" lines across Node versions.
  const nodeTest = (...args) => [node, "--test", "--test-reporter=tap", ...args];
  const ci = (name) => [["bash", ciScript, name, release]];
  switch (gate) {
    case "install": return [["pnpm", "install", "--frozen-lockfile"]];
    case "ts": return [
      ["pnpm", "exec", "tsc", "--noEmit"],
      ["pnpm", "lint"],
      ["pnpm", "test"],
      nodeTest(...nodeTests),
    ];
    case "node": {
      const tests = files.filter((file) => gateRules.node.test(file) && existsSync(join(cwd, file)));
      return tests.length ? [nodeTest("--", ...tests)] : [];
    }
    case "harness": return [nodeTest("scripts/harness/gates.test.mjs", "scripts/harness/run.test.mjs")];
    case "env": return [[node, "scripts/check-env-manifest.mjs"]];
    case "ui": return [[node, "server/scripts/build-ui.mjs", "--check"]];
    case "deploy": return [
      ["bash", "scripts/deploy-oci.test.sh"],
      ["bash", "deploy/autodeploy/autodeploy.test.sh"],
    ];
    default: return ci(gate);
  }
}
