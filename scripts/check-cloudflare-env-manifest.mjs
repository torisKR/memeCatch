import { readFileSync } from "node:fs";
import { scanEnvNames } from "./cloudflare-env-scan.mjs";

const manifest = JSON.parse(readFileSync(new URL("./cloudflare-env-manifest.json", import.meta.url), "utf8"));
const hits = scanEnvNames();
const entries = new Map(manifest.entries.map((entry) => [entry.name, entry]));
const failures = [];

for (const name of hits.keys()) {
  if (!entries.has(name)) failures.push(`code reads ${name}, which is missing from the manifest`);
}

const kinds = new Set(["var", "secret", "vercel-only", "unused", "local", "builtin"]);
const deployable = new Set(["production", "preview"]);
for (const entry of manifest.entries) {
  if (!kinds.has(entry.kind)) failures.push(`${entry.name} has unknown kind ${entry.kind}`);
  if (!Array.isArray(entry.envs) || entry.envs.some((env) => !deployable.has(env))) {
    failures.push(`${entry.name} has an invalid envs list`);
  }
  if ((entry.kind === "var" || entry.kind === "secret") && entry.envs.length === 0) {
    failures.push(`${entry.name} is ${entry.kind} but is not assigned to an environment`);
  }
  if (entry.kind !== "var" && entry.kind !== "secret" && entry.envs.length > 0) {
    failures.push(`${entry.name} is ${entry.kind} and must not be migrated`);
  }
  if ("value" in entry) failures.push(`${entry.name} must not store a value`);
}

const inventory = new Set(manifest.vercelInventory);
for (const name of inventory) {
  const entry = entries.get(name);
  if (!entry) failures.push(`Vercel name ${name} is missing from the manifest`);
  else if (!["var", "secret", "unused", "vercel-only"].includes(entry.kind)) {
    failures.push(`Vercel name ${name} is classified as ${entry.kind}`);
  }
}

const doc = readFileSync(new URL("../docs/cloudflare-migration.md", import.meta.url), "utf8");
for (const [heading, kind] of [
  ["USED", "used"],
  ["UNUSED", "unused"],
  ["Vercel-only", "vercel-only"],
]) {
  const section = doc.split(`<!-- env-${kind}:start -->`)[1]?.split(`<!-- env-${kind}:end -->`)[0] ?? "";
  if (!section) failures.push(`docs are missing the ${heading} table`);
  const documented = new Set([...section.matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map((match) => match[1]));
  const expected = manifest.entries
    .filter((entry) => (
      kind === "used"
        ? entry.kind === "var" || entry.kind === "secret"
        : entry.kind === (kind === "vercel-only" ? "vercel-only" : "unused")
    ))
    .map((entry) => entry.name);
  for (const name of expected) {
    if (!documented.has(name)) failures.push(`${heading} table is missing ${name}`);
  }
  for (const name of documented) {
    if (!expected.includes(name)) failures.push(`${heading} table lists ${name}, which is not in that manifest group`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

const used = manifest.entries.filter((entry) => entry.kind === "var" || entry.kind === "secret").length;
console.log(`cloudflare env manifest ok (${hits.size} code names, ${used} migrated)`);
